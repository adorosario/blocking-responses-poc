# Architecture Documentation

## System Overview

AI Stream Guard implements a **buffer-and-veto pattern** for real-time compliance filtering of LLM streaming responses. The system sits as a proxy between AI models and end users, analyzing content before it reaches the client.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (React + TypeScript + SSE)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Server-Sent Events
┌─────────────────────▼───────────────────────────────────────────┐
│                      FastAPI Application                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   SSE Event Stream                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │  │Heartbeat │  │  Chunks  │  │ Windows  │             │  │
│  │  └──────────┘  └──────────┘  └──────────┘             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Buffer-and-Veto Pipeline                   │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │         Token Buffer (20-50 tokens)              │  │  │
│  │  │    [Accumulate] → [Analyze] → [Block/Emit]       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Compliance Analysis Engine                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │  Regex   │→ │ Presidio │→ │  Risk    │            │  │
│  │  │ Patterns │  │    ML    │  │ Scoring  │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘            │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ API Calls
┌─────────────────────▼───────────────────────────────────────────┐
│                        LLM Provider                             │
│                    (OpenAI / Azure / etc.)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Buffer-and-Veto Pipeline

The heart of the system - prevents sensitive content from ever reaching users:

```python
async def flush_tokens(force: bool = False):
    # 1. Analyze ENTIRE buffer including look-ahead
    full_buffer_text = "".join(list(token_buffer))
    
    # 2. Check for compliance violations
    if analyze_buffer(full_buffer_text) >= threshold:
        vetoed = True
        emit_blocked_event()
        return  # Never emit sensitive content
    
    # 3. Only emit safe content
    emit_safe_tokens()
```

**Key Features:**
- Maintains 20-50 token look-ahead buffer
- Analyzes full buffer before ANY emission
- ~250ms micro-delay (configurable)
- Zero leakage guarantee

### 2. Compliance Analysis Engine

Multi-layered detection system:

#### Layer 1: Fast Regex Patterns
- Email addresses
- Phone numbers (international)
- SSNs (with validation)
- Credit cards (with Luhn check)
- Medical record numbers
- API keys and passwords

#### Layer 2: Microsoft Presidio
- ML-based entity recognition
- 20+ entity types supported
- Confidence scoring (threshold: 0.6)
- Custom recognizers for industry-specific patterns

#### Layer 3: Risk Scoring
```python
Risk Score = Σ(Pattern Weight × Detection) + Presidio Score

Example:
- Email detected: 0.5 points
- Presidio confirms: +0.6 points
- Total: 1.1 (blocks at threshold 1.0)
```

### 3. Server-Sent Events (SSE) Implementation

Proper SSE with multiple event types:

```javascript
// Event Types
event: chunk        // Content chunks
event: window       // Analysis windows
event: blocked      // Blocking notifications
event: completed    // Stream completion
event: heartbeat    // Keep-alive signals
event: error        // Error notifications
```

**SSE Features:**
- Automatic reconnection
- Heartbeat for connection monitoring
- Structured JSON payloads
- Event IDs for ordering

### 4. Audit & Compliance System

Complete audit trail for regulatory compliance:

```python
class AuditLog:
    - event_type: str        # stream_started, blocked, completed
    - session_id: str        # Unique session identifier
    - risk_score: float      # Maximum risk detected
    - triggered_rules: List  # Violations found
    - timestamp: datetime    # Event time
    - content_hash: str      # SHA-256 of sensitive content
```

## Data Flow

### Streaming Request Flow

1. **User Input** → FastAPI endpoint (`/chat/stream`)
2. **LLM Request** → OpenAI/Azure API call with streaming=True
3. **Token Reception** → Chunks received from LLM
4. **Buffer Accumulation** → Tokens added to rolling buffer
5. **Full Buffer Analysis** → Entire buffer checked for violations
6. **Decision Point**:
   - **Safe**: Emit oldest tokens, keep buffer
   - **Risky**: Block stream, emit safe template
7. **Client Reception** → SSE events received by frontend

### Risk Assessment Flow

1. **Text Input** → Pattern detector + Presidio analyzer
2. **Pattern Matching** → Regex patterns checked (microseconds)
3. **ML Analysis** → Presidio entity recognition (milliseconds)
4. **Score Calculation** → Weighted sum of all detections
5. **Threshold Check** → Compare against configured limit
6. **Action Decision** → Block/Allow/Rewrite

## Configuration System

### Environment Variables
```env
# Core Settings
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4o-mini
RISK_THRESHOLD=1.0

# Buffer Configuration
DELAY_TOKENS=20          # Look-ahead buffer size
DELAY_MS=250            # Maximum flush delay

# Detection Settings
PRESIDIO_CONFIDENCE_THRESHOLD=0.6
ENABLE_SAFE_REWRITE=true
ENABLE_AUDIT_LOGGING=true
```

### Regional Compliance
```python
COMPLIANCE_POLICY = {
    "regional_weights": {
        "HIPAA": {
            "medical_record": 1.5,
            "phi_hint": 0.8
        },
        "PCI_DSS": {
            "credit_card": 2.0,
            "bank_account": 1.0
        },
        "GDPR": {
            "email": 0.6,
            "name": 0.5
        }
    }
}
```

## Database Schema

### SQLAlchemy Models

```python
class AuditLog(Base):
    id: Integer (Primary Key)
    event_type: String
    timestamp: DateTime
    session_id: String
    user_input_hash: String
    blocked_content_hash: String (nullable)
    risk_score: Float
    triggered_rules: JSON
    presidio_entities: JSON
    processing_time_ms: Integer
    compliance_region: String (nullable)

class MetricsSnapshot(Base):
    id: Integer (Primary Key)
    timestamp: DateTime
    total_requests: Integer
    blocked_requests: Integer
    block_rate: Float
    avg_risk_score: Float
    avg_processing_time: Float
    pattern_detections: JSON
    presidio_detections: JSON
```

## Performance Characteristics

### Latency Breakdown
- Pattern matching: ~1-5ms
- Presidio analysis: ~10-30ms
- Buffer delay: 250ms (configurable)
- Total added latency: ~260-280ms

### Throughput
- Single instance: ~100 concurrent streams
- Horizontally scalable with Redis
- Memory usage: ~100MB base + 50MB per stream

### Optimization Strategies
1. **Pattern Caching**: Compiled regex patterns
2. **Batch Analysis**: Process multiple tokens together
3. **Async Processing**: Non-blocking I/O throughout
4. **Connection Pooling**: Reuse database connections

## Security Considerations

### Data Protection
- Sensitive content never logged in plain text
- SHA-256 hashing for audit trails
- Session-based tracking without PII
- Configurable data retention

### Network Security
- CORS configuration for API access
- Rate limiting (10 requests/minute default)
- SSL/TLS support via reverse proxy
- API key authentication

### Compliance Features
- HIPAA-compliant audit logging
- PCI DSS payment card protection
- GDPR data minimization
- CCPA consumer rights support

## Deployment Architecture

### Container Structure
```yaml
services:
  api:
    - FastAPI application
    - Presidio + spaCy models
    - Pattern detection engine
    
  web:
    - Nginx reverse proxy
    - Static file serving
    - Load balancing ready
    
  redis: (optional)
    - Shared metrics storage
    - Session management
    
  monitoring: (optional)
    - Prometheus metrics
    - Grafana dashboards
```

### Scaling Considerations
1. **Vertical**: Increase buffer size and concurrent streams
2. **Horizontal**: Add API instances behind load balancer
3. **Caching**: Redis for shared state
4. **CDN**: Static assets and API caching

## Testing Strategy

### Unit Tests
- Pattern detection accuracy
- Risk scoring calculations
- Buffer management logic
- SSE event formatting

### Integration Tests
- End-to-end streaming
- Blocking scenarios
- Audit logging
- Metrics collection

### Performance Tests
- Latency measurements
- Throughput limits
- Memory usage
- CPU utilization

## Future Enhancements

### Planned Features
1. **LLM Judge**: Secondary AI validation for edge cases
2. **Custom Vocabularies**: Industry-specific dictionaries
3. **Multi-language Support**: Beyond English detection
4. **WebSocket Support**: Alternative to SSE
5. **GraphQL API**: Modern API interface

### Optimization Opportunities
1. **GPU Acceleration**: For Presidio ML models
2. **Rust Extensions**: Performance-critical paths
3. **Edge Deployment**: CDN-based filtering
4. **Streaming Transformers**: Direct model integration