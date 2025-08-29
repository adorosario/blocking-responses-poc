# pip install fastapi uvicorn langchain-openai langchain-core presidio-analyzer spacy tiktoken slowapi
# python -m spacy download en_core_web_lg
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import AsyncIterator, Dict, Any, List, Optional
from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from collections import deque
from time import monotonic
import asyncio
import re
import json
import hashlib
import logging
import random
import secrets  # For cryptographically secure session IDs
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from .env file
load_dotenv()

# Database imports
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    select,
    desc,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# --- Microsoft Presidio for industrial PII/PHI detection ---
try:
    from presidio_analyzer import (
        AnalyzerEngine,
        PatternRecognizer,
        Pattern,
    )
    from presidio_analyzer.nlp_engine import SpacyNlpEngine

    PRESIDIO_AVAILABLE = True
except ImportError:
    PRESIDIO_AVAILABLE = False
    print(
        "Warning: Presidio not available. Install with: pip install presidio-analyzer"
    )

# --- Tokenizer for reliable token windows ---
try:
    import tiktoken

    enc = tiktoken.get_encoding("cl100k_base")  # type: ignore
    TIKTOKEN_AVAILABLE = True
except ImportError:
    enc = None  # type: ignore
    TIKTOKEN_AVAILABLE = False
    print("Warning: tiktoken not available. Install with: pip install tiktoken")


# Configuration
class Settings(BaseSettings):
    openai_api_key: str = ""
    default_model: str = "gpt-4o-mini"
    judge_model: str = "gpt-4o-mini"
    log_level: str = "INFO"

    # SSE and buffering settings
    delay_tokens: int = 24
    delay_ms: int = 250

    # NEW: Sliding Window Analysis Settings
    analysis_window_size: int = 200  # tokens to analyze at once for compliance
    analysis_overlap: int = 50       # tokens overlap between analysis windows
    analysis_frequency: int = 200    # analyze every N tokens (instead of every token)
    
    # Compliance thresholds
    risk_threshold: float = 0.7  # Fixed default to match env file
    presidio_confidence_threshold: float = 0.85  # Increased to reduce false positives
    judge_threshold: float = 0.8
    enable_judge: bool = True

    # Safe rewrite settings
    enable_safe_rewrite: bool = True
    rewrite_temperature: float = 0.2

    # Compliance features
    enable_audit_logging: bool = True
    audit_retention_days: int = 30
    hash_sensitive_data: bool = True

    # CORS and security
    cors_origins: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", case_sensitive=False)

    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from string to list"""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()

# -------------------- Rate Limiting Setup --------------------
limiter = Limiter(key_func=get_remote_address)

# -------------------- Database Setup --------------------
Base = declarative_base()  # type: ignore


class AuditLog(Base):  # type: ignore
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(50), nullable=False)
    user_input_hash = Column(String(32), nullable=False)
    blocked_content_hash = Column(String(32), nullable=True)
    risk_score = Column(Float, nullable=False)
    triggered_rules = Column(Text, nullable=False)  # JSON string
    session_id = Column(String(32), nullable=True)
    compliance_region = Column(String(20), nullable=True)
    presidio_entities = Column(Text, nullable=True)  # JSON string
    processing_time_ms = Column(Float, nullable=True)


class MetricsSnapshot(Base):  # type: ignore
    __tablename__ = "metrics_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    total_requests = Column(Integer, nullable=False)
    blocked_requests = Column(Integer, nullable=False)
    block_rate = Column(Float, nullable=False)
    avg_risk_score = Column(Float, nullable=False)
    avg_processing_time = Column(Float, nullable=False)
    pattern_detections = Column(Text, nullable=False)  # JSON string
    presidio_detections = Column(Text, nullable=False)  # JSON string


# Database configuration
DATABASE_URL = "sqlite+aiosqlite:///./compliance_audit.db"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


# Initialize database
async def init_database():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Logging setup
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("blocking_responses_regulated")


# Pydantic models
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)  # Reduced from 10000 for security
    model: Optional[str] = Field(None, max_length=100)
    system_prompt: Optional[str] = Field(None, max_length=1000)
    delay_tokens: Optional[int] = Field(None, ge=5, le=50)  # Reduced max for security
    delay_ms: Optional[int] = Field(None, ge=50, le=1000)  # Reduced max for performance
    risk_threshold: Optional[float] = Field(None, ge=0.0, le=2.0)  # Reduced max for safety
    enable_safe_rewrite: Optional[bool] = None
    region: Optional[str] = Field(
        None, description="Compliance region: US, EU, HIPAA, PCI", max_length=10
    )
    api_key: Optional[str] = Field(
        None, description="OpenAI API key (overrides environment variable)", max_length=200
    )
    # Dynamic analysis configuration
    analysis_window_size: Optional[int] = Field(None, ge=50, le=500, description="Token window size for analysis")
    analysis_frequency: Optional[int] = Field(None, ge=5, le=500, description="Analyze every N tokens")


class ComplianceResult(BaseModel):
    score: float
    blocked: bool
    triggered_rules: List[str]
    presidio_entities: List[Dict[str, Any]] = []
    snippet_hash: Optional[str] = None
    compliance_region: Optional[str] = None
    timestamp: datetime


class AuditEvent(BaseModel):
    event_type: str
    user_input_hash: str
    blocked_content_hash: Optional[str] = None
    risk_score: float
    triggered_rules: List[str]
    timestamp: datetime
    session_id: Optional[str] = None


# FastAPI app
app = FastAPI(
    title="Blocking Responses API - Regulated Edition",
    description="Production-ready SSE proxy with PII/PHI/PCI compliance for regulated industries",
    version="1.1.0",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
origins = settings.get_cors_origins()
# Security: Don't allow credentials with wildcard origins
allow_credentials = "*" not in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

# -------------------- Compliance Policy Configuration --------------------
COMPLIANCE_POLICY: Dict[str, Any] = {
    "threshold": 0.7,  # Will be updated to settings.risk_threshold after initialization
    "weights": {
        # PII (Personally Identifiable Information)
        "email": 0.5,  # Increased to ensure emails are blocked when combined with Presidio
        "phone": 0.5,  # Increased to ensure phone numbers are blocked
        "ssn": 1.0,  # Increased for better protection
        "dob": 0.4,
        "address": 0.4,
        "name": 0.2,
        # PCI (Payment Card Industry)  
        "credit_card": 0.9,  # Reduced from 1.5 to allow legitimate examples
        "iban": 0.7,
        "bank_account": 0.5,
        "routing_number": 0.6,
        # PHI (Protected Health Information - HIPAA)
        "medical_record": 0.6,  # Reduced from 1.0 to allow legitimate examples
        "phi_hint": 0.4,
        "diagnosis": 0.6,  # Reduced from 0.8
        "medication": 0.5,
        # Security credentials
        "password": 0.4,
        "api_key": 0.6,  # Reduced from 0.8
        "secret": 0.5,
        # Presidio base weight
        "presidio": 0.3,  # Reduced further to minimize false positives
    },
    # HIPAA/PHI contextual terms that increase risk when present
    "phi_terms": [
        r"\bdiagnosed\b",
        r"\bmedical record\b",
        r"\bmrn\b",
        r"\bpatient\b",
        r"\bicd-10\b",
        r"\bcpt\b",
        r"\bprescription\b",
        r"\bmedication\b",
        r"\btreatment\b",
        r"\btherapy\b",
        r"\bsymptoms\b",
        r"\bdisease\b",
        r"\bpediatric\b",
        r"\boncology\b",
        r"\bpsychiatr(y|ic)\b",
        r"\bhospital\b",
        r"\bclinic\b",
        r"\bdoctor\b",
        r"\bnurse\b",
        r"\bphysician\b",
    ],
    # PCI/Financial contextual terms
    "pci_terms": [
        r"\bcredit card\b",
        r"\bdebit card\b",
        r"\bcard number\b",
        r"\bexpir(y|ation)\b",
        r"\bcvv\b",
        r"\bsecurity code\b",
        r"\bpin\b",
        r"\bbank account\b",
        r"\brouting number\b",
        r"\biban\b",
        r"\bswift\b",
        r"\bpayment\b",
    ],
    # Regional compliance variations
    "regional_weights": {
        "HIPAA": {"phi_hint": 1.0, "medical_record": 1.5},
        "PCI": {"credit_card": 2.0, "bank_account": 1.2},
        "GDPR": {"email": 0.6, "name": 0.5, "address": 0.7},
        "CCPA": {"email": 0.5, "phone": 0.6},
    },
}

SAFE_TEMPLATES = {
    "pii": "I need to keep personal information private. Let me provide a general response instead:\n\n",
    "phi": "For healthcare privacy compliance, I'll provide general medical information instead:\n\n",
    "pci": "I can't process payment information. Here's general financial guidance instead:\n\n",
    "general": "Let me rephrase this to keep it safe and compliant:\n\n",
}


# -------------------- Enhanced Pattern Detection --------------------
class RegulatedPatternDetector:
    def __init__(self):
        # Enhanced patterns for regulated industries
        self.patterns = {
            # PII patterns
            "email": re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b"),
            "phone": re.compile(
                r"(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){1}\d{3}[-.\s]?\d{4}(?!\d)"
            ),
            "ssn": re.compile(r"\b\d{3}-?\d{2}-?\d{4}\b"),
            "dob": re.compile(
                r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{4})\b",
                re.I,
            ),
            "address": re.compile(
                r"\b\d{1,5}\s+[A-Za-z0-9.\-\s]+\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Court|Ct\.?)\b",
                re.I,
            ),
            # PCI patterns
            "credit_card_candidate": re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
            "iban": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),
            "routing_number": re.compile(r"\b\d{9}\b"),
            "bank_account": re.compile(
                r"\b(?:account\s*number|acct\s*#?)\s*:?\s*\d{6,17}\b", re.I
            ),
            # PHI patterns
            "medical_record": re.compile(
                r"\b(?:mrn|medical\s*record\s*number)\s*:?\s*\d+\b", re.I
            ),
            "diagnosis": re.compile(
                r"\b(?:diagnosed\s+with|diagnosis\s*:)\s*[a-z\s]+\b", re.I
            ),
            "medication": re.compile(
                r"\b(?:prescribed|taking|medication)\s+[a-z]+(?:cillin|prazole|statin|mycin)\b",
                re.I,
            ),
            # Security patterns
            "password": re.compile(
                r"\b(?:password|passwd|passphrase)\s*[:=]?\s*\S+\b", re.I
            ),
            "api_key": re.compile(
                r"\b(?:api[_-]?key|secret[_-]?key|bearer\s+[A-Za-z0-9\._\-]+)\b", re.I
            ),
            "secret": re.compile(r"\b(?:secret|token)\s*[:=]\s*\S+\b", re.I),
            # Contextual patterns
            "phi_context": re.compile("|".join(COMPLIANCE_POLICY["phi_terms"]), re.I),
            "pci_context": re.compile("|".join(COMPLIANCE_POLICY["pci_terms"]), re.I),
        }

    def luhn_check(self, card_number: str) -> bool:
        """Luhn algorithm for credit card validation"""
        digits = [int(d) for d in re.sub(r"[^\d]", "", card_number)]
        if len(digits) < 13 or len(digits) > 19:
            return False

        checksum = 0
        is_even = False
        for d in reversed(digits):
            if is_even:
                d *= 2
                if d > 9:
                    d -= 9
            checksum += d
            is_even = not is_even

        return checksum % 10 == 0

    def assess_compliance_risk(
        self, text: str, region: Optional[str] = None
    ) -> ComplianceResult:
        """Comprehensive compliance risk assessment"""
        weights = COMPLIANCE_POLICY["weights"].copy()

        # Apply regional weight adjustments
        if region and region in COMPLIANCE_POLICY["regional_weights"]:
            weights.update(COMPLIANCE_POLICY["regional_weights"][region])

        score = 0.0
        triggered_rules = []

        # Pattern-based detection
        for pattern_name, pattern in self.patterns.items():
            if pattern_name == "credit_card_candidate":
                # Special handling for credit cards with Luhn check
                for match in pattern.finditer(text):
                    if self.luhn_check(match.group(0)):
                        score += weights.get("credit_card", 1.5)
                        triggered_rules.append(
                            "credit_card: Valid credit card number detected"
                        )
                        break
            elif pattern.search(text):
                weight_key = pattern_name.replace("_candidate", "").replace(
                    "_context", "_hint"
                )
                score += weights.get(weight_key, 0.5)
                triggered_rules.append(f"{pattern_name}: Pattern detected")

        # Create hash of sensitive snippet if needed
        snippet_hash = None
        if settings.hash_sensitive_data and score > 0:
            snippet_hash = hashlib.sha256(text.encode()).hexdigest()[:16]

        blocked = score >= COMPLIANCE_POLICY["threshold"]

        return ComplianceResult(
            score=score,
            blocked=blocked,
            triggered_rules=triggered_rules,
            snippet_hash=snippet_hash,
            compliance_region=region,
            timestamp=datetime.utcnow(),
        )


# -------------------- Utility Functions --------------------
def generate_session_id() -> str:
    """Generate cryptographically secure session ID"""
    return secrets.token_hex(6)  # 12 character hex string

def sanitize_for_logging(text: str, max_length: int = 50) -> str:
    """Sanitize text for safe logging without exposing PII"""
    if not text:
        return ""
    # Truncate and mask potential sensitive data
    truncated = text[:max_length]
    # Replace potential SSN, credit card patterns with asterisks for logging
    sanitized = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '***-**-****', truncated)
    sanitized = re.sub(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '****-****-****-****', sanitized)
    return sanitized

# -------------------- Metrics Tracking --------------------
class MetricsTracker:
    def __init__(self):
        self.total_requests = 0
        self.blocked_requests = 0
        self.judge_calls = 0
        self.risk_scores = []
        self.delay_times = []
        self.pattern_detections = {}
        self.presidio_detections = {}
        self.start_time = monotonic()
        
        # New tracking for input and response windows
        self.input_windows_analyzed = 0
        self.response_windows_analyzed = 0
        self.max_risk_score = 0.0

    def record_request(self, blocked=False, delay_ms=0, risk_score=0.0):
        """Record a request with its metrics"""
        self.total_requests += 1
        if blocked:
            self.blocked_requests += 1

        # Update max risk score
        self.max_risk_score = max(self.max_risk_score, risk_score)

        # Keep last 1000 risk scores for averaging
        self.risk_scores.append(risk_score)
        if len(self.risk_scores) > 1000:
            self.risk_scores.pop(0)

        # Keep last 1000 delay times for averaging
        self.delay_times.append(delay_ms)
        if len(self.delay_times) > 1000:
            self.delay_times.pop(0)

    def record_input_window(self):
        """Record an input analysis window"""
        self.input_windows_analyzed += 1

    def record_response_window(self):
        """Record a response analysis window"""
        self.response_windows_analyzed += 1

    def record_pattern_detection(self, pattern_name):
        """Record a pattern detection"""
        self.pattern_detections[pattern_name] = (
            self.pattern_detections.get(pattern_name, 0) + 1
        )

    def record_presidio_detection(self, entity_type):
        """Record a Presidio entity detection"""
        self.presidio_detections[entity_type] = (
            self.presidio_detections.get(entity_type, 0) + 1
        )

    def record_judge_call(self):
        """Record an LLM judge call"""
        self.judge_calls += 1

    @property
    def block_rate(self):
        """Calculate block rate as percentage"""
        if self.total_requests == 0:
            return 0.0
        return (self.blocked_requests / self.total_requests) * 100

    @property
    def avg_risk_score(self):
        """Calculate average risk score"""
        if not self.risk_scores:
            return 0.0
        return sum(self.risk_scores) / len(self.risk_scores)

    @property
    def avg_processing_time(self):
        """Calculate average processing time in ms"""
        if not self.delay_times:
            return 0.0
        return sum(self.delay_times) / len(self.delay_times)

    @property
    def avg_response_time(self):
        """Calculate average response time (same as processing time for now)"""
        return self.avg_processing_time

    @property
    def requests_per_second(self):
        """Calculate requests per second"""
        elapsed = monotonic() - self.start_time
        if elapsed == 0:
            return 0.0
        return self.total_requests / elapsed

    @property
    def error_rate(self):
        """Calculate error rate (placeholder for now)"""
        return 0.0

    def get_audit_logs(self):
        """Get audit logs (now returns a placeholder - use get_audit_logs() function for real data)"""
        return []


metrics = MetricsTracker()
pattern_detector = RegulatedPatternDetector()


# -------------------- Presidio Integration --------------------
class PresidioDetector:
    def __init__(self):
        self.analyzer = None
        if PRESIDIO_AVAILABLE:
            try:
                self._initialize_presidio()
            except Exception as e:
                logger.warning(f"Failed to initialize Presidio: {e}")
                self.analyzer = None

    def _initialize_presidio(self):
        """Initialize Presidio with custom recognizers for regulated industries"""
        try:
            # Use basic configuration - it should work without spaCy models
            self.analyzer = AnalyzerEngine()
            logger.info("Presidio initialized with basic configuration")
        except Exception as e:
            logger.error(f"Failed to initialize Presidio: {e}")
            self.analyzer = None

        # Add custom recognizers for regulated industries if analyzer is available
        if self.analyzer:
            self._add_custom_recognizers()
            logger.info("Custom recognizers added to Presidio")

    def _add_custom_recognizers(self):
        """Add custom pattern recognizers for specific regulated content"""
        if not self.analyzer:
            return

        # Medical Record Number recognizer
        mrn_pattern = Pattern(
            name="medical_record_number",
            regex=r"\b(?:mrn|medical\s*record\s*number)\s*:?\s*\d{6,10}\b",
            score=0.9,
        )
        mrn_recognizer = PatternRecognizer(
            supported_entity="MEDICAL_RECORD_NUMBER", patterns=[mrn_pattern]
        )
        self.analyzer.registry.add_recognizer(mrn_recognizer)

        # Enhanced credit card recognizer with better patterns
        cc_pattern = Pattern(
            name="enhanced_credit_card",
            regex=r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
            score=0.95,
        )
        cc_recognizer = PatternRecognizer(
            supported_entity="ENHANCED_CREDIT_CARD", patterns=[cc_pattern]
        )
        self.analyzer.registry.add_recognizer(cc_recognizer)

    def analyze_text(self, text: str) -> tuple[float, List[Dict[str, Any]]]:
        """Analyze text with Presidio and return risk score and entities"""
        if not self.analyzer:
            return 0.0, []

        try:
            results = self.analyzer.analyze(text=text, language="en")
            score = 0.0
            entities = []

            for result in results:
                if result.score >= settings.presidio_confidence_threshold:
                    score += COMPLIANCE_POLICY["weights"]["presidio"] * result.score
                    entities.append(
                        {
                            "entity_type": result.entity_type,
                            "start": result.start,
                            "end": result.end,
                            "score": result.score,
                            "text": text[result.start: result.end],
                        }
                    )

            return score, entities
        except Exception as e:
            logger.error(f"Presidio analysis failed: {e}")
            return 0.0, []


presidio_detector = PresidioDetector()


# -------------------- Token Handling --------------------
def token_count(text: str) -> int:
    """Count tokens in text"""
    if TIKTOKEN_AVAILABLE and enc:
        return len(enc.encode(text))
    # Fallback: estimate ~4 characters per token
    return max(1, len(text) // 4)


def tail_tokens(text: str, n_tokens: int) -> str:
    """Get the last N tokens from text"""
    if TIKTOKEN_AVAILABLE and enc:
        tokens = enc.encode(text)
        if len(tokens) <= n_tokens:
            return text
        tail_tokens = tokens[-n_tokens:]
        return enc.decode(tail_tokens)

    # Fallback: estimate character count
    chars = n_tokens * 4
    return text[-chars:] if len(text) > chars else text


# -------------------- Sliding Window Analysis Engine --------------------
class SlidingWindowAnalyzer:
    """Efficient sliding window analysis for compliance checking"""
    
    def __init__(self, window_size=None, frequency=None, overlap_size=None):
        self.window_size = window_size or settings.analysis_window_size
        self.overlap_size = overlap_size or settings.analysis_overlap
        self.frequency = frequency or settings.analysis_frequency
        self.last_analysis_position = 0
        self.analysis_history = []
        self.cumulative_risk = 0.0
        self.total_tokens_processed = 0
        
    def should_analyze(self, current_position: int) -> bool:
        """Determine if we should run analysis at current position"""
        tokens_since_last = current_position - self.last_analysis_position
        return tokens_since_last >= self.frequency
    
    def extract_analysis_window(self, full_text: str, current_position: int) -> tuple[str, int, int]:
        """Extract the analysis window from full text"""
        if TIKTOKEN_AVAILABLE and enc:
            tokens = enc.encode(full_text)
            total_tokens = len(tokens)
            
            # Calculate window boundaries
            window_start = max(0, current_position - self.window_size + self.overlap_size)
            window_end = min(total_tokens, current_position + self.overlap_size)
            
            # Extract window tokens and convert back to text
            window_tokens = tokens[window_start:window_end]
            window_text = enc.decode(window_tokens)
            
            return window_text, window_start, window_end
        else:
            # Fallback: character-based estimation
            chars_per_token = 4
            char_start = max(0, (current_position - self.window_size + self.overlap_size) * chars_per_token)
            char_end = min(len(full_text), (current_position + self.overlap_size) * chars_per_token)
            
            return full_text[char_start:char_end], char_start // chars_per_token, char_end // chars_per_token
    
    def analyze_window(self, window_text: str, window_start: int, window_end: int, region: Optional[str] = None) -> Dict[str, Any]:
        """Analyze a specific window for compliance violations"""
        # Pattern-based analysis
        compliance_result = pattern_detector.assess_compliance_risk(window_text, region)
        
        # Presidio-based analysis
        presidio_score, presidio_entities = presidio_detector.analyze_text(window_text)
        
        # Combine scores
        total_score = compliance_result.score + presidio_score
        
        analysis_result = {
            "window_text": window_text,
            "window_start": window_start,
            "window_end": window_end,
            "window_size": window_end - window_start,
            "pattern_score": compliance_result.score,
            "presidio_score": presidio_score,
            "total_score": total_score,
            "triggered_rules": compliance_result.triggered_rules,
            "presidio_entities": presidio_entities,
            "blocked": total_score >= settings.risk_threshold,
            "timestamp": datetime.utcnow().isoformat(),
            "analysis_position": self.total_tokens_processed
        }
        
        # Update state
        self.last_analysis_position = self.total_tokens_processed
        self.cumulative_risk = max(self.cumulative_risk, total_score)
        self.analysis_history.append(analysis_result)
        
        # Keep only last 10 analyses for memory efficiency
        if len(self.analysis_history) > 10:
            self.analysis_history = self.analysis_history[-10:]
            
        return analysis_result
    
    def process_new_tokens(self, new_text: str, full_text: str, region: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Process new tokens and return analysis result if analysis should be performed"""
        # Update token count
        new_token_count = token_count(new_text)
        self.total_tokens_processed += new_token_count
        
        # Check if we should analyze
        if not self.should_analyze(self.total_tokens_processed):
            return None
            
        # Extract and analyze window
        window_text, window_start, window_end = self.extract_analysis_window(
            full_text, self.total_tokens_processed
        )
        
        return self.analyze_window(window_text, window_start, window_end, region)
    
    def get_analysis_stats(self) -> Dict[str, Any]:
        """Get statistics about the analysis process"""
        total_analyses = len(self.analysis_history)
        blocked_analyses = sum(1 for a in self.analysis_history if a["blocked"])
        
        return {
            "total_tokens_processed": self.total_tokens_processed,
            "total_analyses_performed": total_analyses,
            "blocked_analyses": blocked_analyses,
            "analysis_frequency": self.frequency,
            "window_size": self.window_size,
            "overlap_size": self.overlap_size,
            "cumulative_risk": self.cumulative_risk,
            "last_analysis_position": self.last_analysis_position,
            "efficiency_ratio": self.total_tokens_processed / max(total_analyses, 1),  # tokens per analysis
            "recent_analyses": self.analysis_history[-5:] if self.analysis_history else []
        }


# -------------------- SSE Helpers --------------------
def sse_event(data: str, event: Optional[str] = None, id: Optional[str] = None) -> str:
    """Format data as Server-Sent Events"""
    parts = []
    if event:
        parts.append(f"event: {event}")
    if id:
        parts.append(f"id: {id}")

    # Split data into lines per SSE spec
    for line in data.splitlines():
        parts.append(f"data: {line}")

    parts.append("")  # Blank line ends the event
    return "\n".join(parts) + "\n"


async def heartbeat_generator(queue: asyncio.Queue, interval: int = 15):
    """Generate heartbeat events to keep connection alive"""
    while True:
        try:
            await asyncio.sleep(interval)
            await queue.put(sse_event("[heartbeat]", event="heartbeat"))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            break


def get_valid_api_key(provided_api_key: Optional[str] = None) -> Optional[str]:
    """Get a valid API key, prioritizing provided key over environment variable.
    Returns None if environment variable is a placeholder."""
    env_api_key = settings.openai_api_key
    
    # If a key is provided via parameter, use it
    if provided_api_key:
        return provided_api_key
    
    # If environment variable is set and not a placeholder, use it
    if env_api_key and env_api_key != "your_openai_api_key_here":
        return env_api_key
    
    # No valid API key available
    return None


# -------------------- LLM Streaming --------------------
async def upstream_stream(
    user_input: str, model: Optional[str] = None, api_key: Optional[str] = None
) -> AsyncIterator[str]:
    """Stream from upstream LLM"""
    system_prompt = (
        "You are a helpful, professional assistant for regulated industries. "
        "NEVER output personal identifiers, medical record numbers, social security numbers, "
        "credit card numbers, or other sensitive regulated information. "
        "Provide helpful responses while maintaining strict compliance standards."
    )

    prompt = ChatPromptTemplate.from_messages(
        [("system", system_prompt), ("human", "{input}")]
    )

    llm = ChatOpenAI(
        model=model or settings.default_model,
        streaming=True,
        temperature=0.3,
        api_key=SecretStr(get_valid_api_key(api_key)) if get_valid_api_key(api_key) else None,
    )

    chain = prompt | llm | StrOutputParser()

    try:
        async for piece in chain.astream({"input": user_input}):
            yield piece
    except Exception as e:
        logger.error(f"Upstream streaming error: {e}")
        yield f"[Error: {str(e)}]"


async def safe_rewrite_stream(
    user_input: str, detected_types: List[str], api_key: Optional[str] = None
) -> AsyncIterator[str]:
    """Generate a safe, compliant rewrite of the response"""
    if not settings.enable_safe_rewrite:
        yield "I cannot provide a response due to compliance restrictions."
        return

    # Choose appropriate template based on detected content types
    template = SAFE_TEMPLATES["general"]
    if any("phi" in rule or "medical" in rule for rule in detected_types):
        template = SAFE_TEMPLATES["phi"]
    elif any(
        "credit" in rule or "bank" in rule or "pci" in rule for rule in detected_types
    ):
        template = SAFE_TEMPLATES["pci"]
    elif any(
        "email" in rule or "phone" in rule or "ssn" in rule for rule in detected_types
    ):
        template = SAFE_TEMPLATES["pii"]

    yield template

    system_prompt = (
        "You are a compliance-safe assistant. Rewrite responses to be helpful while removing all "
        "personal identifiers, medical information, financial details, and other regulated content. "
        "Focus on general concepts and publicly available information only. "
        "Never include names, addresses, phone numbers, emails, SSNs, credit card numbers, "
        "medical record numbers, or any PII/PHI/PCI data."
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "Provide a safe, compliant response to: {input}"),
        ]
    )

    llm = ChatOpenAI(
        model=settings.judge_model,
        streaming=True,
        temperature=settings.rewrite_temperature,
        api_key=SecretStr(get_valid_api_key(api_key)) if get_valid_api_key(api_key) else None,
    )

    chain = prompt | llm | StrOutputParser()

    try:
        async for piece in chain.astream({"input": user_input}):
            yield piece
    except Exception as e:
        logger.error(f"Safe rewrite error: {e}")
        yield "I apologize, but I cannot provide a response due to compliance requirements."


# -------------------- Audit Logging --------------------
async def log_audit_event(
    event: AuditEvent,
    processing_time_ms: Optional[float] = None,
    presidio_entities: Optional[List[Dict]] = None,
):
    """Log compliance audit events to database and logs"""
    if not settings.enable_audit_logging:
        return

    try:
        # Log to console/file (existing functionality)
        audit_data = {
            "timestamp": event.timestamp.isoformat(),
            "event_type": event.event_type,
            "user_input_hash": event.user_input_hash,
            "blocked_content_hash": event.blocked_content_hash,
            "risk_score": event.risk_score,
            "triggered_rules": event.triggered_rules,
            "session_id": event.session_id,
        }

        logger.info(f"AUDIT_EVENT: {json.dumps(audit_data)}")

        # Save to database
        async with async_session() as session:
            db_audit = AuditLog(
                timestamp=event.timestamp,
                event_type=event.event_type,
                user_input_hash=event.user_input_hash,
                blocked_content_hash=event.blocked_content_hash,
                risk_score=event.risk_score,
                triggered_rules=json.dumps(event.triggered_rules),
                session_id=event.session_id,
                presidio_entities=(
                    json.dumps(presidio_entities) if presidio_entities else None
                ),
                processing_time_ms=processing_time_ms,
            )
            session.add(db_audit)
            await session.commit()

        # TODO: Send to secure audit storage system
        # await audit_storage.store_event(audit_data)

    except Exception as e:
        logger.error(f"Audit logging failed: {e}")


async def save_metrics_snapshot():
    """Save current metrics to database"""
    try:
        async with async_session() as session:
            snapshot = MetricsSnapshot(
                total_requests=metrics.total_requests,
                blocked_requests=metrics.blocked_requests,
                block_rate=metrics.block_rate,
                avg_risk_score=metrics.avg_risk_score,
                avg_processing_time=metrics.avg_processing_time,
                pattern_detections=json.dumps(dict(metrics.pattern_detections)),
                presidio_detections=json.dumps(dict(metrics.presidio_detections)),
            )
            session.add(snapshot)
            await session.commit()
    except Exception as e:
        logger.error(f"Failed to save metrics snapshot: {e}")


async def get_audit_logs(
    limit: int = 100, event_type: Optional[str] = None
) -> List[Dict]:
    """Retrieve audit logs from database"""
    try:
        async with async_session() as session:
            query = select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit)
            if event_type:
                query = query.where(AuditLog.event_type == event_type)

            result = await session.execute(query)
            logs = result.scalars().all()

            processed_logs = []
            for log in logs:
                entities_data = (
                    json.loads(str(log.presidio_entities)) if log.presidio_entities else []
                )
                logger.info(f"DEBUG: Raw presidio_entities: {log.presidio_entities}")
                logger.info(f"DEBUG: Parsed entities_data: {entities_data}")

                # Ensure entities are in the correct format
                formatted_entities = []
                for entity in entities_data:
                    if (
                        isinstance(entity, dict)
                        and "entity_type" in entity
                        and "score" in entity
                    ):
                        formatted_entities.append(entity)
                    elif isinstance(entity, str):
                        formatted_entities.append({"entity_type": entity, "score": 0.5})
                    else:
                        logger.warning(f"Unknown entity format: {entity}")

                # Determine compliance type from patterns
                triggered_rules_list = json.loads(str(log.triggered_rules)) if log.triggered_rules else []
                compliance_type = "PII"  # default
                
                # Check patterns to determine compliance type - prioritize medical/financial over general PII
                has_phi = False
                has_financial = False
                
                for rule in triggered_rules_list:
                    rule_lower = rule.lower()
                    if "credit" in rule_lower or "card" in rule_lower or "pci" in rule_lower:
                        has_financial = True
                    elif "medical" in rule_lower or "phi" in rule_lower or "patient" in rule_lower or "diagnosis" in rule_lower:
                        has_phi = True
                    elif "presidio" in rule_lower and ("date" in rule_lower or "time" in rule_lower):
                        # DATE_TIME in medical context could be HIPAA
                        if log.risk_score > 0.7:  # Higher risk suggests medical context
                            has_phi = True
                    elif "email" in rule_lower and log.compliance_region == "GDPR":
                        compliance_type = "GDPR"
                
                # Set compliance type based on detected patterns
                if has_financial:
                    compliance_type = "PCI_DSS"
                elif has_phi:
                    compliance_type = "HIPAA"
                # else stays as "PII" default

                return_data = {
                    "id": log.id,
                    "timestamp": log.timestamp.replace(tzinfo=timezone.utc).isoformat(),
                    "event_type": log.event_type,
                    "session_id": log.session_id or f"session_{log.id}",
                    "compliance_type": compliance_type,
                    "risk_score": log.risk_score,
                    "blocked": log.blocked_content_hash is not None,
                    "decision_reason": f"Risk score: {log.risk_score:.2f} - {'Content blocked due to compliance violations' if log.blocked_content_hash else 'Content processed successfully - no violations detected'}",
                    "entities_detected": formatted_entities,
                    "patterns_detected": (
                        json.loads(str(log.triggered_rules)) if log.triggered_rules else []
                    ),
                    "content_hash": log.blocked_content_hash or log.user_input_hash,
                    "processing_time_ms": log.processing_time_ms,
                }
                logger.info(
                    f"Final return data entities: {return_data['entities_detected']}"
                )
                processed_logs.append(return_data)

            return processed_logs
    except Exception as e:
        logger.error(f"Failed to retrieve audit logs: {e}")
        return []


# -------------------- Main SSE Endpoint --------------------
@app.post("/api/chat/stream")
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute per IP
async def chat_stream_sse(request: Request, chat_req: ChatRequest):
    """SSE endpoint with regulated industry compliance"""

    # Use API key from request if provided, otherwise fall back to environment variable
    # But check if the environment variable is a placeholder
    api_key = get_valid_api_key(chat_req.api_key)
    
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="OpenAI API key is required. Please provide it in the request or set a valid key in the .env file"
        )

    # Configuration
    delay_tokens = chat_req.delay_tokens or settings.delay_tokens
    delay_ms = chat_req.delay_ms or settings.delay_ms
    risk_threshold = chat_req.risk_threshold or settings.risk_threshold

    # Log user input for audit purposes only (NO BLOCKING)
    user_compliance_result = pattern_detector.assess_compliance_risk(
        chat_req.message, chat_req.region
    )
    user_presidio_score, user_presidio_entities = presidio_detector.analyze_text(
        chat_req.message
    )
    user_total_score = user_compliance_result.score + user_presidio_score
    
    # Record input window analysis (user input is always analyzed as 1 window)
    metrics.record_input_window()
    
    # Log user input for audit (informational only - never block)
    logger.info(f"User input analysis (audit only) - Score: {user_total_score:.2f}, Rules: {user_compliance_result.triggered_rules}")

    async def event_generator() -> AsyncIterator[bytes]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
        heartbeat_task = asyncio.create_task(heartbeat_generator(queue))

        vetoed = False
        last_flush = monotonic()
        start_time = monotonic()  # Track processing start time
        token_buffer: deque = deque()
        window_text = ""
        event_id = 0

        # Generate session ID for audit tracking
        session_id = generate_session_id()
        user_input_hash = hashlib.sha256(chat_req.message.encode()).hexdigest()[:16]
        
        # Initialize tracking for AI output analysis
        max_ai_output_risk_score = 0.0
        all_ai_triggered_rules = []

        async def emit_event(data: str, event: str = "chunk", event_id_val: Optional[int] = None, risk_score: Optional[float] = None):
            nonlocal event_id
            if event_id_val is None:
                event_id += 1
                event_id_val = event_id
            
            # Format data as JSON for frontend consumption
            event_data = {
                "type": event,
                "content": data,
                "timestamp": datetime.utcnow().isoformat(),
                "risk_score": risk_score
            }
            await queue.put(sse_event(json.dumps(event_data), event=event, id=str(event_id_val)))

        # Emit input window analysis event
        await emit_event(
            json.dumps({
                "window_text": chat_req.message,
                "window_start": 0,
                "window_end": token_count(chat_req.message),
                "window_size": token_count(chat_req.message),
                "analysis_position": 0,
                "pattern_score": user_compliance_result.score,
                "presidio_score": user_presidio_score,
                "total_score": user_total_score,
                "triggered_rules": user_compliance_result.triggered_rules,
                "presidio_entities": user_presidio_entities,
                "analysis_type": "input",
                "window_number": 1
            }),
            event="input_window",
            risk_score=user_total_score
        )

        async def flush_tokens(force: bool = False):
            """Flush tokens from buffer while maintaining look-ahead window"""
            nonlocal last_flush, vetoed
            
            # If already vetoed, don't process anymore
            if vetoed:
                return
                
            if not token_buffer:
                return

            # Calculate how many tokens to emit (keeping delay_tokens as look-ahead)
            total_tokens = sum(token_count(piece) for piece in token_buffer)

            if force:
                # Flush everything at end of stream
                pieces_to_emit = len(token_buffer)
            else:
                # Keep look-ahead window
                target_tokens = max(0, total_tokens - delay_tokens)
                pieces_to_emit = 0

                if target_tokens > 0:
                    accumulated_tokens = 0
                    for i, piece in enumerate(token_buffer):
                        piece_tokens = token_count(piece)
                        if accumulated_tokens + piece_tokens <= target_tokens:
                            pieces_to_emit = i + 1
                            accumulated_tokens += piece_tokens
                        else:
                            break

            # CRITICAL FIX: Analyze the ENTIRE buffer including look-ahead window
            # This ensures we catch sensitive content before ANY of it is shown
            full_buffer_text = "".join(list(token_buffer))
            
            # Analyze the FULL buffer for compliance violations
            if full_buffer_text and not vetoed:  # Check vetoed status before analysis
                buffer_compliance_result = pattern_detector.assess_compliance_risk(full_buffer_text, chat_req.region)
                buffer_presidio_score, buffer_presidio_entities = presidio_detector.analyze_text(full_buffer_text)
                buffer_total_score = buffer_compliance_result.score + buffer_presidio_score
                
                # If the FULL buffer contains violations, block immediately (ONLY ONCE)
                if buffer_total_score >= risk_threshold and not vetoed:
                    vetoed = True  # Set flag BEFORE emitting event
                    logger.warning(f"AI output blocked (buffer analysis) - Score: {buffer_total_score:.2f}, Content: {sanitize_for_logging(full_buffer_text)}")
                    
                    # Emit blocking event ONLY ONCE
                    await emit_event(
                        f"AI response blocked due to compliance violation (risk score: {buffer_total_score:.2f})",
                        event="blocked",
                        risk_score=buffer_total_score
                    )
                    
                    # Update tracking with the violation details
                    nonlocal max_ai_output_risk_score, all_ai_triggered_rules
                    max_ai_output_risk_score = max(max_ai_output_risk_score, buffer_total_score)
                    all_ai_triggered_rules.extend(buffer_compliance_result.triggered_rules)
                    
                    # Record metrics for blocked request
                    elapsed_ms = (monotonic() - start_time) * 1000
                    metrics.record_request(
                        blocked=True, delay_ms=elapsed_ms, risk_score=buffer_total_score
                    )
                    
                    # Record pattern detections for metrics
                    for rule in buffer_compliance_result.triggered_rules:
                        pattern_name = rule.split(":")[0].strip()
                        metrics.record_pattern_detection(pattern_name)
                    
                    # Create audit event for blocked stream
                    audit_event = AuditEvent(
                        event_type="stream_blocked",
                        user_input_hash=user_input_hash,
                        blocked_content_hash=hashlib.sha256(full_buffer_text.encode()).hexdigest()[:16],
                        risk_score=buffer_total_score,
                        triggered_rules=buffer_compliance_result.triggered_rules,
                        timestamp=datetime.utcnow(),
                        session_id=session_id,
                    )
                    await log_audit_event(
                        audit_event, processing_time_ms=elapsed_ms, presidio_entities=buffer_presidio_entities
                    )
                    
                    return
            
            # Only proceed with emission if buffer analysis passed
            pieces_to_analyze = []
            for _ in range(pieces_to_emit):
                if token_buffer:
                    pieces_to_analyze.append(token_buffer.popleft())
            
            # Double-check the pieces we're about to emit (redundant but safe)
            if pieces_to_analyze and not vetoed:  # Check vetoed to avoid duplicate notifications
                combined_text = "".join(pieces_to_analyze)
                
                # Analyze AI output for compliance violations
                ai_compliance_result = pattern_detector.assess_compliance_risk(combined_text, chat_req.region)
                ai_presidio_score, ai_presidio_entities = presidio_detector.analyze_text(combined_text)
                ai_total_score = ai_compliance_result.score + ai_presidio_score
                
                # Update tracking (already declared nonlocal above)
                max_ai_output_risk_score = max(max_ai_output_risk_score, ai_total_score)
                all_ai_triggered_rules.extend(ai_compliance_result.triggered_rules)
                
                # Final check before emission (only if not already vetoed)
                if ai_total_score >= risk_threshold and not vetoed:
                    vetoed = True  # Set flag BEFORE emitting
                    logger.warning(f"AI output blocked (emission check) - Score: {ai_total_score:.2f}, Content: {sanitize_for_logging(combined_text)}")
                    
                    # Emit blocking event ONLY ONCE
                    await emit_event(
                        f"AI response blocked due to compliance violation (risk score: {ai_total_score:.2f})",
                        event="blocked",
                        risk_score=ai_total_score
                    )
                    
                    # Record metrics for blocked request
                    elapsed_ms = (monotonic() - start_time) * 1000
                    metrics.record_request(
                        blocked=True, delay_ms=elapsed_ms, risk_score=ai_total_score
                    )
                    
                    # Record pattern detections for metrics
                    for rule in ai_compliance_result.triggered_rules:
                        pattern_name = rule.split(":")[0].strip()
                        metrics.record_pattern_detection(pattern_name)
                    
                    # Create audit event for blocked stream
                    audit_event = AuditEvent(
                        event_type="stream_blocked",
                        user_input_hash=user_input_hash,
                        blocked_content_hash=hashlib.sha256(combined_text.encode()).hexdigest()[:16],
                        risk_score=ai_total_score,
                        triggered_rules=ai_compliance_result.triggered_rules,
                        timestamp=datetime.utcnow(),
                        session_id=session_id,
                    )
                    await log_audit_event(
                        audit_event, processing_time_ms=elapsed_ms, presidio_entities=ai_presidio_entities
                    )
                    
                    return
                
                # If analysis passes, emit the pieces
                for piece in pieces_to_analyze:
                    await emit_event(piece, event="chunk")

            last_flush = monotonic()

        async def compliance_check_and_stream():
            nonlocal window_text, vetoed, max_ai_output_risk_score, all_ai_triggered_rules

            # No user input analysis - that was the fundamental error
            # Now we focus on AI output analysis during streaming

            # Initialize sliding window analyzer for response monitoring (display purposes)
            analyzer = SlidingWindowAnalyzer(
                window_size=chat_req.analysis_window_size,
                frequency=chat_req.analysis_frequency
            )
            response_text = ""
            response_window_count = 0

            try:
                async for piece in upstream_stream(
                    chat_req.message, chat_req.model, api_key
                ):
                    if vetoed:
                        break

                    # Add piece to buffer
                    token_buffer.append(piece)
                    window_text = (window_text + piece)[-8000:]  # Keep for display purposes
                    response_text += piece

                    # Create response windows for display (every ~25 tokens or window_size/6)
                    response_tokens = token_count(response_text) if TIKTOKEN_AVAILABLE else len(response_text.split())
                    window_threshold = max(25, settings.analysis_window_size // 6)
                    
                    if response_tokens > 0 and response_tokens % window_threshold == 0:
                        response_window_count += 1
                        # Record response window analysis for metrics
                        metrics.record_response_window()
                        
                        # Analyze recent AI output for compliance display
                        window_start = max(0, response_tokens - window_threshold)
                        recent_response = response_text[-500:] if len(response_text) > 500 else response_text
                        
                        # Actually analyze the AI output window
                        window_compliance_result = pattern_detector.assess_compliance_risk(recent_response, chat_req.region)
                        window_presidio_score, window_presidio_entities = presidio_detector.analyze_text(recent_response)
                        window_total_score = window_compliance_result.score + window_presidio_score
                        
                        await emit_event(
                            json.dumps({
                                "window_text": recent_response,
                                "window_start": window_start,
                                "window_end": response_tokens,
                                "window_size": min(window_threshold, response_tokens),
                                "analysis_position": response_tokens,
                                "pattern_score": window_compliance_result.score,
                                "presidio_score": window_presidio_score,
                                "total_score": window_total_score,
                                "triggered_rules": window_compliance_result.triggered_rules,
                                "presidio_entities": window_presidio_entities,
                                "analysis_type": "response",
                                "window_number": response_window_count
                            }),
                            event="response_window",
                            risk_score=window_total_score
                        )

                    # Stream with AI output analysis and delay
                    await flush_tokens()
                    await asyncio.sleep(delay_ms / 1000.0)

                # End of stream - flush remaining tokens if not vetoed
                if not vetoed:
                    await flush_tokens(force=True)
                    
                    # Calculate analysis efficiency stats
                    input_tokens = len(enc.encode(chat_req.message)) if TIKTOKEN_AVAILABLE and enc else len(chat_req.message.split())
                    response_tokens = token_count(response_text) if TIKTOKEN_AVAILABLE else len(response_text.split())
                    
                    await emit_event(
                        json.dumps({
                            "message": "Stream completed successfully",
                            "analysis_stats": {
                                "input_tokens": input_tokens,
                                "response_tokens": response_tokens,
                                "response_windows_analyzed": response_window_count,
                                "max_ai_output_risk_score": max_ai_output_risk_score,
                                "ai_triggered_rules_count": len(all_ai_triggered_rules)
                            },
                            "compliance_summary": f"AI output analyzed in {response_window_count} windows with max risk score {max_ai_output_risk_score:.2f}",
                            "analysis_type": "AI_OUTPUT_ANALYSIS"
                        }),
                        event="completed",
                        risk_score=max_ai_output_risk_score
                    )

                    # Log successful completion with analysis stats
                    elapsed_ms = (monotonic() - start_time) * 1000
                    # Calculate efficiency ratio
                    total_tokens = response_tokens if response_tokens > 0 else 1
                    efficiency_ratio = total_tokens / max(response_window_count, 1)
                    
                    audit_event = AuditEvent(
                        event_type="stream_completed",
                        user_input_hash=user_input_hash,
                        blocked_content_hash=None,
                        risk_score=max_ai_output_risk_score,
                        triggered_rules=all_ai_triggered_rules + [f"analysis_efficiency: {efficiency_ratio:.1f}x"],
                        timestamp=datetime.utcnow(),
                        session_id=session_id,
                    )
                    await log_audit_event(
                        audit_event, processing_time_ms=elapsed_ms, presidio_entities=[]
                    )

                    # Record metrics for successful completion
                    metrics.record_request(
                        blocked=False, delay_ms=elapsed_ms, risk_score=max_ai_output_risk_score
                    )

            except Exception as e:
                logger.error(f"Streaming error: {e}")
                await emit_event(f"Error: {str(e)}", event="error")

        # Start the streaming task
        stream_task = asyncio.create_task(compliance_check_and_stream())

        try:
            while True:
                # Get next event from queue
                try:
                    event_data = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield event_data.encode("utf-8")
                    queue.task_done()
                except asyncio.TimeoutError:
                    # Check if streaming is done
                    if stream_task.done() and queue.empty():
                        break
                    continue

                # Check if streaming task completed and queue is empty
                if stream_task.done() and queue.empty():
                    break

        except Exception as e:
            logger.error(f"SSE event generation error: {e}")
        finally:
            # Clean up tasks
            heartbeat_task.cancel()
            if not stream_task.done():
                stream_task.cancel()

            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

            try:
                await stream_task
            except asyncio.CancelledError:
                pass

    # SSE response headers
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # Disable nginx buffering
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    return StreamingResponse(
        event_generator(), media_type="text/event-stream", headers=headers
    )


# Legacy GET endpoint for backwards compatibility
@app.get("/api/chat/stream")
async def chat_stream_get(request: Request, q: str):
    """Legacy GET endpoint"""
    chat_req = ChatRequest(
        message=q,
        delay_tokens=None,
        delay_ms=None,
        risk_threshold=None,
        region=None,
        api_key=None
    )
    return await chat_stream_sse(request, chat_req)


# -------------------- Additional API Endpoints --------------------
@app.post("/api/assess-risk")
async def assess_compliance_risk(text: str, region: Optional[str] = None):
    """Comprehensive compliance risk assessment"""
    start_time = monotonic()

    # Pattern-based assessment
    compliance_result = pattern_detector.assess_compliance_risk(text, region)

    # Presidio-based assessment
    presidio_score, presidio_entities = presidio_detector.analyze_text(text)

    # Combine results
    total_score = compliance_result.score + presidio_score
    is_blocked = total_score >= settings.risk_threshold

    # Record metrics
    processing_time = (monotonic() - start_time) * 1000  # Convert to ms
    metrics.record_request(
        blocked=is_blocked, delay_ms=processing_time, risk_score=total_score
    )

    # Record pattern detections
    for rule in compliance_result.triggered_rules:
        pattern_name = rule.split(":")[0].strip()
        metrics.record_pattern_detection(pattern_name)

    # Record Presidio detections
    for entity in presidio_entities:
        metrics.record_presidio_detection(entity.get("entity_type", "unknown"))

    return {
        "score": total_score,
        "blocked": is_blocked,
        "pattern_score": compliance_result.score,
        "presidio_score": presidio_score,
        "triggered_rules": compliance_result.triggered_rules,
        "presidio_entities": presidio_entities,
        "compliance_region": region,
        "snippet_hash": compliance_result.snippet_hash,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/compliance/analyze-text")
async def analyze_text_compliance(request: dict):
    """Analyze text for compliance issues - for testing and debugging"""
    text = request.get("text", "")
    region = request.get("region", None)
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    start_time = monotonic()

    # Pattern-based assessment
    compliance_result = pattern_detector.assess_compliance_risk(text, region)

    # Presidio-based assessment
    presidio_score, presidio_entities = presidio_detector.analyze_text(text)

    # Combine results
    total_score = compliance_result.score + presidio_score
    is_blocked = total_score >= settings.risk_threshold

    processing_time = (monotonic() - start_time) * 1000

    return {
        "text": text,
        "total_score": total_score,
        "blocked": is_blocked,
        "pattern_score": compliance_result.score,
        "presidio_score": presidio_score,
        "triggered_rules": compliance_result.triggered_rules,
        "presidio_entities": presidio_entities,
        "compliance_region": region,
        "snippet_hash": compliance_result.snippet_hash,
        "processing_time_ms": processing_time,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/health")
async def health_check():
    """Enhanced health check with dependency status"""
    dependencies = {
        "tiktoken": TIKTOKEN_AVAILABLE,
        "presidio": PRESIDIO_AVAILABLE and presidio_detector.analyzer is not None,
        "openai_configured": bool(settings.openai_api_key),
    }

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.1.0",
        "dependencies": dependencies,
        "compliance_features": {
            "audit_logging": settings.enable_audit_logging,
            "safe_rewrite": settings.enable_safe_rewrite,
            "hash_sensitive_data": settings.hash_sensitive_data,
        },
    }


@app.get("/api/compliance/patterns")
async def get_compliance_patterns():
    """Get available compliance patterns and their weights"""
    return {
        "patterns": {
            name: {
                "weight": COMPLIANCE_POLICY["weights"].get(name, 0.5),
                "description": f"Detects {name.replace('_', ' ')} patterns",
            }
            for name in pattern_detector.patterns.keys()
        },
        "regional_adjustments": COMPLIANCE_POLICY["regional_weights"],
        "threshold": COMPLIANCE_POLICY["threshold"],
        "presidio_available": PRESIDIO_AVAILABLE,
        "tiktoken_available": TIKTOKEN_AVAILABLE,
    }


@app.get("/api/compliance/analysis-config")
async def get_analysis_config():
    """Get sliding window analysis configuration"""
    return {
        "current_config": {
            "analysis_window_size": settings.analysis_window_size,
            "analysis_overlap": settings.analysis_overlap,
            "analysis_frequency": settings.analysis_frequency,
            "risk_threshold": settings.risk_threshold,
            "delay_tokens": settings.delay_tokens,
            "delay_ms": settings.delay_ms,
        },
        "config_ranges": {
            "analysis_window_size": {"min": 50, "max": 500, "default": 150},
            "analysis_frequency": {"min": 5, "max": 100, "default": 25},
            "risk_threshold": {"min": 0.1, "max": 1.0, "default": 0.7},
        },
        "efficiency_info": {
            "traditional_approach": "Analyze every single token",
            "new_approach_cost": f"1 analysis per {settings.analysis_frequency} tokens",
            "efficiency_gain": f"{settings.analysis_frequency}x reduction in analysis calls",
            "cost_savings": f"~{((settings.analysis_frequency - 1) / settings.analysis_frequency * 100):.1f}% cost reduction"
        }
    }


@app.get("/api/compliance/config")
async def get_compliance_config():
    """Get current compliance configuration"""
    return {
        "risk_threshold": settings.risk_threshold,
        "presidio_confidence_threshold": settings.presidio_confidence_threshold,
        "delay_tokens": settings.delay_tokens,
        "delay_ms": settings.delay_ms,
        "enable_safe_rewrite": settings.enable_safe_rewrite,
        "enable_audit_logging": settings.enable_audit_logging,
        "hash_sensitive_data": settings.hash_sensitive_data,
        "audit_retention_days": settings.audit_retention_days,
    }


@app.get("/api/metrics")
async def get_metrics():
    """Get real-time system metrics"""
    return {
        "total_requests": metrics.total_requests,
        "blocked_requests": metrics.blocked_requests,
        "block_rate": metrics.block_rate,
        "avg_risk_score": metrics.avg_risk_score,
        "max_risk_score": metrics.max_risk_score,
        "input_windows_analyzed": metrics.input_windows_analyzed,
        "response_windows_analyzed": metrics.response_windows_analyzed,
        "pattern_detections": dict(metrics.pattern_detections),
        "presidio_detections": dict(metrics.presidio_detections),
        "performance_metrics": {
            "avg_processing_time": metrics.avg_processing_time,
            "avg_response_time": metrics.avg_response_time,
            "requests_per_second": metrics.requests_per_second,
            "error_rate": metrics.error_rate,
        },
    }


@app.get("/api/config")
async def get_config():
    """Get general system configuration"""
    return {
        "delay_tokens": settings.delay_tokens,
        "delay_ms": settings.delay_ms,
        "risk_threshold": settings.risk_threshold,
        "default_model": settings.default_model,
        "judge_model": settings.judge_model,
        "enable_judge": settings.enable_judge,
        "judge_threshold": settings.judge_threshold,
        "enable_safe_rewrite": settings.enable_safe_rewrite,
        "enable_audit_logging": settings.enable_audit_logging,
        "hash_sensitive_data": settings.hash_sensitive_data,
        "cors_origins": settings.get_cors_origins(),
        # NEW: Sliding window configuration
        "analysis_window_size": settings.analysis_window_size,
        "analysis_overlap": settings.analysis_overlap,
        "analysis_frequency": settings.analysis_frequency,
    }


@app.get("/api/compliance/analysis-config")
async def get_analysis_config():
    """Get detailed analysis configuration for frontend controls"""
    return {
        "current_config": {
            "analysis_window_size": settings.analysis_window_size,
            "analysis_overlap": settings.analysis_overlap,
            "analysis_frequency": settings.analysis_frequency,
            "risk_threshold": settings.risk_threshold,
            "delay_tokens": settings.delay_tokens,
            "delay_ms": settings.delay_ms
        },
        "config_limits": {
            "analysis_window_size": {"min": 50, "max": 500, "default": 150},
            "analysis_overlap": {"min": 10, "max": 100, "default": 50},
            "analysis_frequency": {"min": 5, "max": 100, "default": 25},
            "risk_threshold": {"min": 0.1, "max": 2.0, "default": 0.7},
            "delay_tokens": {"min": 5, "max": 100, "default": 24},
            "delay_ms": {"min": 50, "max": 2000, "default": 250}
        },
        "performance_estimates": {
            "old_approach_cost": "1 analysis per token",
            "new_approach_cost": f"1 analysis per {settings.analysis_frequency} tokens",
            "efficiency_gain": f"{settings.analysis_frequency}x reduction in analysis calls",
            "context_improvement": f"{settings.analysis_window_size} token context vs single token"
        }
    }


@app.get("/api/audit-logs")
async def get_audit_logs_endpoint(limit: int = 100, event_type: Optional[str] = None):
    """Get audit logs from database"""
    logs = await get_audit_logs(limit=limit, event_type=event_type)
    return {
        "logs": logs,
        "count": len(logs),
        "total_available": len(
            logs
        ),  # In a real system, this would be a separate count query
    }


@app.post("/api/metrics/snapshot")
async def create_metrics_snapshot():
    """Create a snapshot of current metrics"""
    try:
        # Get current metrics
        current_metrics = metrics.get_metrics()

        # Create snapshot record
        async with async_session() as session:
            snapshot = MetricsSnapshot(
                timestamp=datetime.utcnow(),
                total_requests=current_metrics["total_requests"],
                blocked_requests=current_metrics["blocked_requests"],
                block_rate=current_metrics["block_rate"],
                avg_risk_score=current_metrics["avg_risk_score"],
                pattern_detections=current_metrics["pattern_detections"],
                presidio_detections=current_metrics["presidio_detections"],
                performance_metrics=current_metrics["performance_metrics"],
            )
            session.add(snapshot)
            await session.commit()

        return {
            "status": "snapshot_created",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error creating metrics snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- Test Suite Management --------------------

# In-memory test suite results
test_suite_results = {
    "basic": {
        "tests": 16,
        "status": "pending",
        "passed": 0,
        "failed": 0,
        "warnings": 0,
    },
    "patterns": {
        "tests": 4,
        "status": "pending",
        "passed": 0,
        "failed": 0,
        "warnings": 0,
    },
    "presidio": {
        "tests": 3,
        "status": "pending",
        "passed": 0,
        "failed": 0,
        "warnings": 0,
    },
    "streaming": {
        "tests": 3,
        "status": "pending",
        "passed": 0,
        "failed": 0,
        "warnings": 0,
    },
}


def update_test_results(
    suite_id: str, passed: int, failed: int, warnings: int, total_tests: int
):
    """Update test results for a specific suite"""
    if suite_id in test_suite_results:
        test_suite_results[suite_id].update(
            {
                "tests": total_tests,
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
                "status": (
                    "completed" if (passed + failed) == total_tests else "running"
                ),
            }
        )


# Test Suite Endpoints
@app.get("/api/test/suites")
async def get_test_suites():
    """Get available test suites with dynamic results"""
    return {
        "suites": [
            {
                "id": "basic",
                "name": "Basic Functionality",
                "description": "Core API endpoints and health checks",
                **test_suite_results["basic"],
            },
            {
                "id": "patterns",
                "name": "Pattern Detection",
                "description": "Regex pattern detection accuracy",
                **test_suite_results["patterns"],
            },
            {
                "id": "presidio",
                "name": "Presidio Integration",
                "description": "Microsoft Presidio ML detection",
                **test_suite_results["presidio"],
            },
            {
                "id": "streaming",
                "name": "SSE Streaming",
                "description": "Server-Sent Events and validation",
                **test_suite_results["streaming"],
            },
        ]
    }


@app.post("/api/test/run")
async def run_test_suite(request: dict):
    """Run specific test suites"""
    import subprocess

    suites = request.get("suites", [])

    try:
        # Run the actual test suite
        if not suites or "all" in suites:
            # Run all basic tests
            result = subprocess.run(
                ["python", "-m", "pytest", "test_app_basic.py", "-v", "--tb=short"],
                capture_output=True,
                text=True,
                timeout=60,
            )
        else:
            # Run specific test files based on suite names
            test_files = []
            if "basic" in suites:
                test_files.extend(
                    [
                        "test_app_basic.py::TestBasicFunctionality",
                        "test_app_basic.py::TestRiskAssessment",
                        "test_app_basic.py::TestStreamingEndpoint",
                    ]
                )
            if "patterns" in suites:
                test_files.append("test_app_basic.py::TestPatternDetection")
            if "presidio" in suites:
                test_files.append("test_app_basic.py::TestPresidioIntegration")
            if "streaming" in suites:
                test_files.append("test_app_basic.py::TestStreamingEndpoint")

            if test_files:
                result = subprocess.run(
                    ["python", "-m", "pytest"] + test_files + ["-v", "--tb=short"],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
            else:
                result = subprocess.run(
                    ["python", "-m", "pytest", "test_app_basic.py", "-v", "--tb=short"],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )

        # Parse test results from pytest output
        test_output = result.stdout + result.stderr
        passed_tests = test_output.count(" PASSED")
        failed_tests = test_output.count(" FAILED")

        # Better warning parsing - look for "X warnings" in the summary line
        warnings_count = 0
        if "warnings in" in test_output:
            # Find the line like "======================== 16 passed, 7 warnings in 3.76s ========================"
            import re

            warning_match = re.search(r"(\d+) warnings in", test_output)
            if warning_match:
                warnings_count = int(warning_match.group(1))

        total_tests = passed_tests + failed_tests

        # Parse individual test class results from the detailed output
        # Count tests by class name patterns
        # Note: These counts are approximate based on test output parsing

        # Better approach: Parse the actual test results by looking for test class patterns
        import re

        # Count passed/failed for each test class
        basic_tests = len(
            re.findall(
                r"test_app_basic\.py::TestBasicFunctionality::\w+ PASSED", test_output
            )
        )
        basic_tests += len(
            re.findall(
                r"test_app_basic\.py::TestRiskAssessment::\w+ PASSED", test_output
            )
        )
        basic_failed_count = len(
            re.findall(
                r"test_app_basic\.py::TestBasicFunctionality::\w+ FAILED", test_output
            )
        )
        basic_failed_count += len(
            re.findall(
                r"test_app_basic\.py::TestRiskAssessment::\w+ FAILED", test_output
            )
        )

        streaming_tests = len(
            re.findall(
                r"test_app_basic\.py::TestStreamingEndpoint::\w+ PASSED", test_output
            )
        )
        streaming_failed_count = len(
            re.findall(
                r"test_app_basic\.py::TestStreamingEndpoint::\w+ FAILED", test_output
            )
        )

        pattern_tests = len(
            re.findall(
                r"test_app_basic\.py::TestPatternDetection::\w+ PASSED", test_output
            )
        )
        pattern_failed_count = len(
            re.findall(
                r"test_app_basic\.py::TestPatternDetection::\w+ FAILED", test_output
            )
        )

        presidio_tests = len(
            re.findall(
                r"test_app_basic\.py::TestPresidioIntegration::\w+ PASSED", test_output
            )
        )
        presidio_failed_count = len(
            re.findall(
                r"test_app_basic\.py::TestPresidioIntegration::\w+ FAILED", test_output
            )
        )

        # Update suite results based on actual parsed results
        update_test_results(
            "basic",
            basic_tests,
            basic_failed_count,
            warnings_count,
            basic_tests + basic_failed_count,
        )
        update_test_results(
            "patterns",
            pattern_tests,
            pattern_failed_count,
            warnings_count,
            pattern_tests + pattern_failed_count,
        )
        update_test_results(
            "presidio",
            presidio_tests,
            presidio_failed_count,
            warnings_count,
            presidio_tests + presidio_failed_count,
        )
        update_test_results(
            "streaming",
            streaming_tests,
            streaming_failed_count,
            warnings_count,
            streaming_tests + streaming_failed_count,
        )

        return {
            "session_id": f"test_session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "status": "completed" if result.returncode == 0 else "failed",
            "output": test_output,
            "summary": {
                "passed": passed_tests,
                "failed": failed_tests,
                "warnings": warnings_count,
                "total": total_tests,
            },
        }

    except subprocess.TimeoutExpired:
        return {
            "session_id": f"test_session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "status": "timeout",
            "output": "Test execution timed out after 60 seconds",
            "summary": {"passed": 0, "failed": 0, "total": 0},
        }
    except Exception as e:
        logger.error(f"Error running tests: {e}")
        return {
            "session_id": f"test_session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "status": "error",
            "output": f"Error running tests: {str(e)}",
            "summary": {"passed": 0, "failed": 0, "total": 0},
        }


@app.get("/api/test/results/{session_id}")
async def get_test_results(session_id: str):
    """Get test results for a specific session"""
    # For now, return the current test status
    # In a real implementation, you'd store session results
    return {
        "session_id": session_id,
        "status": "completed",
        "suites": await get_test_suites(),
        "timestamp": datetime.utcnow().isoformat(),
    }


# Enhanced Audit Logs Endpoint
@app.get("/api/compliance/audit-logs")
async def get_compliance_audit_logs(
    limit: int = 50,
    offset: int = 0,
    compliance_type: Optional[str] = None,
    blocked_only: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Get compliance audit logs with filtering"""
    try:
        async with async_session() as session:
            query = select(AuditLog)

            # Apply filters
            if compliance_type:
                # Since compliance_type isn't in schema, skip this filter for now
                pass
            if blocked_only:
                query = query.where(AuditLog.blocked_content_hash.isnot(None))
            if start_date:
                start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.timestamp >= start_dt)
            if end_date:
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.timestamp <= end_dt)

            # Add ordering and pagination
            query = (
                query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
            )

            result = await session.execute(query)
            logs = result.scalars().all()

            # Convert to dict format matching frontend expectations
            audit_events = []
            for log in logs:
                entities_data = (
                    json.loads(str(log.presidio_entities)) if log.presidio_entities else []
                )
                logger.info(f"DEBUG: Raw presidio_entities: {log.presidio_entities}")
                logger.info(f"DEBUG: Parsed entities_data: {entities_data}")

                # Ensure entities are in the correct format
                formatted_entities = []
                for entity in entities_data:
                    if (
                        isinstance(entity, dict)
                        and "entity_type" in entity
                        and "score" in entity
                    ):
                        formatted_entities.append(entity)
                    elif isinstance(entity, str):
                        formatted_entities.append({"entity_type": entity, "score": 0.5})
                    else:
                        logger.warning(f"Unknown entity format: {entity}")

                audit_events.append(
                    {
                        "id": log.id,
                        "timestamp": log.timestamp.replace(
                            tzinfo=timezone.utc
                        ).isoformat(),
                        "event_type": log.event_type,
                        "session_id": log.session_id or f"session_{log.id}",
                        "compliance_type": log.compliance_region or "PII",
                        "risk_score": log.risk_score,
                        "blocked": log.blocked_content_hash is not None,
                        "decision_reason": f"Risk score: {log.risk_score:.2f} - {'Content blocked due to compliance violations' if log.blocked_content_hash else 'Content processed successfully - no violations detected'}",
                        "entities_detected": formatted_entities,
                        "patterns_detected": (
                            json.loads(str(log.triggered_rules))
                            if log.triggered_rules
                            else []
                        ),
                        "content_hash": log.blocked_content_hash or log.user_input_hash,
                        "processing_time_ms": log.processing_time_ms,
                    }
                )
                logger.info(
                    f"DEBUG: Final return data entities: {audit_events[-1]['entities_detected']}"
                )

            return {
                "events": audit_events,
                "total": len(audit_events),
                "has_more": len(audit_events) == limit,
                "filters_applied": {
                    "compliance_type": compliance_type,
                    "blocked_only": blocked_only,
                    "date_range": {"start": start_date, "end": end_date},
                },
            }

    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        return {"events": [], "total": 0, "has_more": False, "error": str(e)}


@app.post("/api/demo/generate-audit-data")
async def generate_demo_audit_data():
    """Generate demo audit data for testing"""
    try:
        demo_events = [
            {
                "text": "Patient John Doe, SSN: 123-45-6789, has diabetes",
                "event_type": "CONTENT_BLOCKED",
                "compliance_type": "HIPAA",
            },
            {
                "text": "Contact me at test@example.com for more info",
                "event_type": "CONTENT_ASSESSED",
                "compliance_type": "PII",
            },
            {
                "text": "Credit card 4532-1234-5678-9012 was charged",
                "event_type": "CONTENT_BLOCKED",
                "compliance_type": "PCI_DSS",
            },
        ]

        generated_count = 0
        for demo in demo_events:
            # Trigger actual compliance assessment to generate real audit logs
            compliance_result = pattern_detector.assess_compliance_risk(demo["text"])
            presidio_score, presidio_entities = presidio_detector.analyze_text(
                demo["text"]
            )

            total_score = compliance_result.score + presidio_score
            is_blocked = total_score >= settings.risk_threshold

            # Create audit event
            audit_event = AuditEvent(
                timestamp=datetime.utcnow(),
                event_type=demo["event_type"],
                user_input_hash=hashlib.sha256(demo["text"].encode()).hexdigest()[:16],
                blocked_content_hash=(
                    compliance_result.snippet_hash if is_blocked else None
                ),
                risk_score=total_score,
                triggered_rules=compliance_result.triggered_rules,
                session_id=f"demo_session_{int(datetime.utcnow().timestamp())}",
            )

            await log_audit_event(
                audit_event,
                processing_time_ms=25.0,
                presidio_entities=presidio_entities,
            )
            generated_count += 1

        return {
            "success": True,
            "generated_events": generated_count,
            "message": f"Generated {generated_count} demo audit events",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.on_event("startup")
# Database initialization
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        # Update compliance policy with actual settings
        COMPLIANCE_POLICY["threshold"] = settings.risk_threshold
        logger.info(f"Compliance threshold set to: {settings.risk_threshold}")
        
        await init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")


# Alternative startup for newer FastAPI versions
async def lifespan(app: FastAPI):
    # Startup
    try:
        await init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    yield

    # Shutdown (if needed)
    pass


# Mount frontend static assets
app.mount("/assets", StaticFiles(directory="static/frontend/assets"), name="frontend_assets")  
app.mount("/static/frontend", StaticFiles(directory="static/frontend"), name="frontend_static")

# Frontend routes (must be last to not override API routes)
@app.get("/")
async def serve_frontend():
    from fastapi.responses import FileResponse
    return FileResponse("static/frontend/index.html")

@app.get("/{path:path}")  
async def catch_all(path: str):
    # If it's an API route that doesn't exist, return 404
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # For all other routes, serve the frontend SPA
    from fastapi.responses import FileResponse
    return FileResponse("static/frontend/index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
