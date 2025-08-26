# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a complete FastAPI-based system for implementing "blocking responses" - a security mechanism that monitors LLM streaming responses in real-time and can block or redirect potentially unsafe content before it reaches the user. It includes a full API, comprehensive test suite, example clients, and deployment configurations.

## Architecture

### Core Components

1. **RegulatedPatternDetector**: Enhanced pattern detection system with regex-based rules for PII, PHI, and PCI compliance
2. **PresidioDetector**: Microsoft Presidio integration for industrial-grade PII/PHI detection with custom recognizers
3. **SSE Streaming Pipeline**: Server-Sent Events implementation with token buffering and real-time compliance checking
4. **Compliance Policy Engine**: Configurable scoring system with regional variations (HIPAA, PCI DSS, GDPR, CCPA)
5. **Safe Rewrite System**: AI-powered content sanitization with context-aware templates
6. **Audit Logging**: Comprehensive compliance audit trail with hashed sensitive data

### Key Files

- `app.py`: Main FastAPI application with all endpoints and core logic
- `test_app.py`: Comprehensive test suite covering all functionality
- `example_client.py`: Full-featured client demonstrating API usage
- `requirements.txt`: Python dependencies including Presidio and spaCy
- `docker-compose.yml`: Multi-service deployment configuration
- `Makefile`: Comprehensive build and deployment commands

### API Endpoints

#### Core Streaming
- `POST /chat/stream`: Main SSE streaming endpoint with real-time content filtering
- `GET /chat/stream?q=message`: Legacy GET endpoint for backwards compatibility

#### Risk Assessment
- `POST /assess-risk?text=content`: Comprehensive compliance assessment without streaming

#### Compliance Management
- `GET /compliance/patterns`: Available compliance patterns by category
- `GET /compliance/config`: Current compliance configuration
- `POST /compliance/safe-rewrite`: AI-powered content sanitization

#### System Health
- `GET /health`: Enhanced health check with dependency status
- `GET /metrics`: Real-time performance and compliance metrics

### Safety Architecture

- **Buffer-and-Veto**: Token-based streaming with configurable look-ahead window
- **Multi-layer Detection**: Fast regex patterns + Presidio ML models
- **Regional Compliance**: HIPAA, PCI DSS, GDPR, and CCPA support
- **Fail-safe Design**: Defaults to blocking on errors or uncertainty
- **Audit Trail**: Complete compliance logging with data hashing

## Development Commands

### Environment Setup
```bash
# Install dependencies (includes Presidio and spaCy models)
pip install -r requirements.txt
python -m spacy download en_core_web_lg

# Copy and configure environment
cp .env.example .env
# Edit .env with your OpenAI API key
```

### Running the Server
```bash
# Development mode
uvicorn app:app --reload

# Production mode
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Running Tests
```bash
# Run all tests
pytest test_app.py -v

# Run specific test categories
pytest test_app.py::TestComplianceDetection -v
pytest test_app.py::TestSSEStreaming -v
pytest test_app.py::TestAuditLogging -v

# Run with coverage
pytest test_app.py --cov=app --cov-report=html
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Start basic services (API + Web)
make start

# Start with monitoring stack
make monitoring

# Run in development mode with logs
make dev

# Access services:
# Web Interface: http://localhost:3000
# API: http://localhost:8000
# API Documentation: http://localhost:8000/docs
```

### Example Client
```bash
# Run demos
python example_client.py

# Interactive mode
python example_client.py interactive
```

## Configuration

### Environment Variables (.env)
- `OPENAI_API_KEY`: Required for LLM functionality
- `DEFAULT_MODEL`: Primary LLM model (default: gpt-4o-mini)
- `JUDGE_MODEL`: Secondary safety judge model (default: gpt-4o-mini)
- `DELAY_TOKENS`: Buffer size in tokens (default: 24)
- `DELAY_MS`: Maximum flush delay in milliseconds (default: 250)
- `RISK_THRESHOLD`: Blocking threshold (default: 1.0)
- `PRESIDIO_CONFIDENCE_THRESHOLD`: Presidio detection threshold (default: 0.6)
- `ENABLE_SAFE_REWRITE`: Enable AI-powered safe responses (default: true)
- `ENABLE_AUDIT_LOGGING`: Enable compliance audit logging (default: true)
- `HASH_SENSITIVE_DATA`: Hash sensitive data in logs (default: true)
- `LOG_LEVEL`: Logging verbosity (default: INFO)
- `CORS_ORIGINS`: Allowed CORS origins (default: *)

### Compliance Scoring System

The system uses a weighted scoring approach where patterns accumulate scores:

#### PII (Personally Identifiable Information)
- Email addresses: 0.4 points
- Phone numbers: 0.5 points
- SSN patterns: 1.2 points (blocks by default)
- Names: 0.3 points
- Addresses: 0.5 points

#### PHI (Protected Health Information - HIPAA)
- Medical record numbers: 1.0 points (blocks by default)
- Diagnosis information: 0.8 points
- Medication references: 0.7 points
- PHI contextual terms: 0.6 points

#### PCI (Payment Card Industry)
- Credit card numbers: 1.5 points (blocks by default)
- IBAN codes: 0.9 points
- Bank account numbers: 0.7 points
- Routing numbers: 0.8 points

#### Security Credentials
- Passwords: 0.5 points
- API keys: 0.8 points
- Secrets/tokens: 0.7 points

#### Presidio Integration
- Base Presidio detections: 0.9 points (weighted by confidence)

### Regional Compliance Variations

Different compliance frameworks have adjusted thresholds and weights:

- **HIPAA**: Stricter PHI detection, medical record weight increased to 1.5
- **PCI DSS**: Enhanced financial data detection, credit card weight increased to 2.0
- **GDPR**: Balanced PII detection with email weight at 0.6
- **CCPA**: Similar to GDPR with phone number weight at 0.6

## Testing Strategy

### Test Categories
1. **ComplianceDetection**: Pattern and Presidio detection accuracy
2. **SSEStreaming**: Server-Sent Events functionality and heartbeat
3. **AuditLogging**: Compliance audit trail validation
4. **ComplianceEndpoints**: Specialized compliance API endpoints
5. **LLMJudge**: Secondary AI safety assessment (mocked)
6. **API**: Core endpoint functionality
7. **StreamBlocking**: End-to-end blocking scenarios
8. **Configuration**: Parameter validation and customization
9. **ErrorHandling**: Graceful failure modes
10. **SafeTemplates**: Context-aware response templates
11. **Metrics**: Performance tracking accuracy

### Running Specific Tests
```bash
# Test compliance detection only
pytest test_app.py::TestComplianceDetection -v

# Test SSE streaming
pytest test_app.py::TestSSEStreaming -v

# Test audit logging
pytest test_app.py::TestAuditLogging -v

# Test with specific pattern
pytest test_app.py -k "test_ssn_detection" -v
```

## Docker Architecture

### Service Components

1. **API Container**: FastAPI app with Presidio and compliance logic
2. **Web Container**: Nginx serving static interface + reverse proxy
3. **Redis Container**: Optional shared metrics storage (profile: redis)
4. **Prometheus Container**: Optional monitoring (profile: monitoring)
5. **Grafana Container**: Optional dashboards (profile: monitoring)

### Common Docker Commands
```bash
# Start basic services
make start

# Development with logs
make dev

# With monitoring stack
make monitoring

# Run tests in container
make test

# Open shell in API container
make shell

# Check service health
make health

# View logs
make logs

# Stop all services
make stop

# Clean up everything
make clean
```

## Performance Considerations

### Latency Optimization
- Presidio analysis runs in parallel with regex patterns
- Token-based buffering balances safety vs. responsiveness
- Configurable flush delays prevent indefinite blocking
- Fast pattern matching executes in microseconds

### Scaling Considerations
- Stateless design supports horizontal scaling
- Nginx automatically load balances multiple API containers
- Redis available for shared metrics across instances
- Presidio models are memory-intensive (4GB+ recommended)

## Security Implementation

### Defense in Depth
1. **Fast Filters**: Immediate detection of obvious patterns
2. **Presidio ML**: Advanced entity recognition for complex cases  
3. **Configurable Thresholds**: Tune sensitivity vs. usability
4. **Safe Rewrite**: AI-powered content sanitization
5. **Audit Logging**: Comprehensive compliance trail

### Privacy Protection
- Sensitive data hashed in audit logs using SHA-256 (truncated to 16 chars)
- Risk assessments don't store full content beyond snippets
- Metrics are aggregated without sensitive details
- Session tracking for audit requirements

## Deployment Options

### Local Development
```bash
# Direct Python execution
uvicorn app:app --reload

# Docker development mode
make dev
```

### Docker Container
```bash
# Basic deployment
docker-compose up -d

# With monitoring
make monitoring

# Production mode
make prod
```

### Production Deployment
- Multi-service architecture with health checks
- Nginx reverse proxy with load balancing
- Environment-based configuration
- Volume persistence for metrics and logs
- Optional SSL termination ready

## Monitoring and Observability

### Built-in Metrics
Available at `/metrics` endpoint:
- Total requests and block rates
- Risk score distributions  
- Presidio detection frequency
- Performance timings
- Audit event summaries

### Health Monitoring
- `/health` endpoint with dependency checks
- Docker health checks for all services
- Prometheus integration available
- Grafana dashboards ready

### Audit Features
- Complete compliance event logging
- Session tracking with hashed identifiers
- Risk assessment history
- Blocking rationale tracking

## Common Development Tasks

### Adding New Risk Patterns
1. Add pattern to `RegulatedPatternDetector.patterns` dictionary
2. Include regex, score assignment in `COMPLIANCE_POLICY["weights"]`
3. Add comprehensive test cases in `TestComplianceDetection`
4. Update regional variations if needed

### Modifying Compliance Thresholds
1. Update `COMPLIANCE_POLICY["threshold"]` or environment variable
2. Adjust regional weights in `COMPLIANCE_POLICY["regional_weights"]`
3. Test with various content types in test suite
4. Monitor metrics for effectiveness

### Extending Presidio Integration
1. Add custom recognizers in `PresidioDetector._add_custom_recognizers()`
2. Update entity scoring in `analyze_text()` method
3. Add corresponding test cases with mocked Presidio responses
4. Monitor performance impact

### Custom Safe Response Templates
1. Add templates to `SAFE_TEMPLATES` dictionary
2. Update template selection logic in `safe_rewrite_stream()`
3. Test with various blocking scenarios
4. Ensure context-appropriate messaging

### Regional Compliance Customization
1. Add new compliance type to `COMPLIANCE_POLICY["regional_weights"]`
2. Update scoring logic in `assess_compliance_risk()`
3. Add endpoint support in compliance routes
4. Create test coverage for new compliance type