# 🚀 Quick Deployment Guide

## Prerequisites
- Docker & Docker Compose
- OpenAI API Key
- 4GB+ RAM

## 1-Minute Setup

```bash
# Clone and configure
git clone <repository-url>
cd blocking-responses-poc

# Set API key
echo "OPENAI_API_KEY=your_key_here" > .env

# Deploy
docker-compose up -d --build

# Verify (wait 60-90 seconds for startup)
curl http://localhost:8000/health
```

## Access Points
- **API**: http://localhost:8000
- **Dashboard**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

## Test the System

```bash
# Test PII detection
curl -X POST "http://localhost:8000/assess-risk?text=My email is test@example.com"

# Test streaming
curl -N -H "Accept: text/event-stream" \
  -X POST http://localhost:8000/chat/stream \
  -d '{"message": "Hello"}'
```

## Troubleshooting
- Check logs: `docker-compose logs -f`
- Restart: `docker-compose restart`
- Clean install: `docker-compose down -v && docker-compose up -d --build`

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions.
