# Production Deployment Guide

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended for Presidio models)
- Valid SSL certificates (for HTTPS)
- Domain name configured with DNS
- OpenAI API key or compatible LLM provider

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### Basic Production Setup

1. **Clone and configure:**
```bash
git clone <repository>
cd blocking-responses-poc

# Create production environment
cp .env.example .env.production
nano .env.production
```

2. **Set production variables:**
```env
# Required
OPENAI_API_KEY=sk-your-production-key
DEFAULT_MODEL=gpt-4o-mini
JUDGE_MODEL=gpt-4o-mini

# Security
RISK_THRESHOLD=1.0
DELAY_TOKENS=20
DELAY_MS=250

# Features
ENABLE_SAFE_REWRITE=true
ENABLE_AUDIT_LOGGING=true
HASH_SENSITIVE_DATA=true

# Performance
LOG_LEVEL=WARNING
CORS_ORIGINS=https://yourdomain.com
```

3. **Start services:**
```bash
# Production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With monitoring
docker-compose --profile monitoring up -d
```

4. **Verify deployment:**
```bash
# Check health
curl https://yourdomain.com/health

# View logs
docker-compose logs -f api
```

### Option 2: Kubernetes Deployment

#### Kubernetes Manifests

1. **Create namespace:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-stream-guard
```

2. **Deploy application:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stream-guard-api
  namespace: ai-stream-guard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stream-guard-api
  template:
    metadata:
      labels:
        app: stream-guard-api
    spec:
      containers:
      - name: api
        image: your-registry/stream-guard:latest
        ports:
        - containerPort: 8000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: openai-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

3. **Service configuration:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: stream-guard-service
  namespace: ai-stream-guard
spec:
  selector:
    app: stream-guard-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

### Option 3: Cloud Platform Deployment

#### AWS ECS/Fargate

```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker build -t stream-guard .
docker tag stream-guard:latest $ECR_URI/stream-guard:latest
docker push $ECR_URI/stream-guard:latest

# Deploy with ECS CLI
ecs-cli compose up --cluster production
```

#### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/stream-guard
gcloud run deploy stream-guard \
  --image gcr.io/PROJECT-ID/stream-guard \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY
```

#### Azure Container Instances

```bash
# Create container instance
az container create \
  --resource-group myResourceGroup \
  --name stream-guard \
  --image yourregistry.azurecr.io/stream-guard:latest \
  --dns-name-label stream-guard \
  --ports 8000 \
  --environment-variables OPENAI_API_KEY=$OPENAI_API_KEY
```

## SSL/TLS Configuration

### Using Nginx Reverse Proxy

1. **Install Nginx:**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

2. **Configure Nginx:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE specific
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

3. **Get SSL certificate:**
```bash
sudo certbot --nginx -d yourdomain.com
```

## Database Setup

### PostgreSQL (Recommended for Production)

1. **Install PostgreSQL:**
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_DB=compliance_audit \
  -e POSTGRES_USER=streamguard \
  -e POSTGRES_PASSWORD=secure_password \
  -v postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15
```

2. **Update connection string:**
```env
DATABASE_URL=postgresql://streamguard:secure_password@localhost:5432/compliance_audit
```

3. **Run migrations:**
```bash
docker-compose exec api alembic upgrade head
```

## Monitoring Setup

### Prometheus + Grafana

1. **Configure Prometheus:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'stream-guard'
    static_configs:
      - targets: ['api:8000']
```

2. **Import Grafana dashboards:**
- Import dashboard ID: 12345 (example)
- Configure data source: Prometheus
- Set refresh interval: 5s for real-time

### Application Monitoring

1. **Health checks:**
```bash
# Automated health monitoring
*/5 * * * * curl -f http://localhost:8000/health || alert
```

2. **Log aggregation:**
```bash
# Using Loki
docker run -d \
  --name loki \
  -v loki-data:/loki \
  -p 3100:3100 \
  grafana/loki:latest
```

## Performance Tuning

### API Optimization

1. **Gunicorn configuration:**
```python
# gunicorn_config.py
workers = 4  # 2 * CPU cores + 1
worker_class = "uvicorn.workers.UvicornWorker"
bind = "0.0.0.0:8000"
keepalive = 120
timeout = 120
```

2. **Run with Gunicorn:**
```bash
gunicorn app:app -c gunicorn_config.py
```

### Presidio Optimization

1. **Pre-load models:**
```python
# In app startup
async def startup_event():
    # Pre-load Presidio models
    analyzer = AnalyzerEngine()
    # Warm up with sample text
    analyzer.analyze("warm up text", language="en")
```

2. **Model caching:**
```python
# Cache Presidio results
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_presidio_analysis(text_hash):
    return presidio_detector.analyze_text(text)
```

## Security Hardening

### API Security

1. **Rate limiting:**
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(request: Request):
    # ...
```

2. **API key authentication:**
```python
from fastapi.security import APIKeyHeader
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.api_key:
        raise HTTPException(status_code=403)
```

### Network Security

1. **Firewall rules:**
```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 443/tcp   # HTTPS
ufw allow 80/tcp    # HTTP redirect
ufw enable
```

2. **Docker network isolation:**
```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

## Backup and Recovery

### Database Backups

1. **Automated backups:**
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker exec postgres pg_dump -U streamguard compliance_audit | gzip > backup_$DATE.sql.gz

# Keep only last 30 days
find . -name "backup_*.sql.gz" -mtime +30 -delete
```

2. **Backup to S3:**
```bash
aws s3 cp backup_$DATE.sql.gz s3://your-bucket/backups/
```

### Disaster Recovery

1. **Multi-region deployment:**
- Primary: US-East-1
- Secondary: EU-West-1
- Database replication between regions

2. **Recovery procedure:**
```bash
# Restore from backup
gunzip < backup_latest.sql.gz | docker exec -i postgres psql -U streamguard compliance_audit

# Verify data integrity
docker-compose exec api python verify_db.py
```

## Maintenance

### Rolling Updates

```bash
# Zero-downtime deployment
docker-compose up -d --no-deps --build api
docker-compose restart nginx
```

### Log Rotation

```bash
# /etc/logrotate.d/stream-guard
/var/log/stream-guard/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
}
```

## Troubleshooting

### Common Issues

1. **High memory usage:**
```bash
# Check memory
docker stats

# Restart with memory limits
docker-compose up -d --memory 2g api
```

2. **Slow response times:**
```bash
# Check buffer settings
echo "DELAY_TOKENS=10" >> .env
echo "DELAY_MS=150" >> .env
docker-compose restart api
```

3. **Connection drops:**
```bash
# Increase timeouts
echo "proxy_read_timeout 300;" >> /etc/nginx/conf.d/timeouts.conf
nginx -s reload
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=DEBUG docker-compose up api

# Stream debug logs
docker-compose logs -f api | grep DEBUG
```

## Compliance Checklist

- [ ] SSL/TLS certificates installed
- [ ] API authentication enabled
- [ ] Audit logging configured
- [ ] Database backups scheduled
- [ ] Monitoring alerts set up
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers added
- [ ] Log rotation configured
- [ ] Disaster recovery plan tested