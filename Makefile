# Makefile for Blocking Responses API

.PHONY: help build start stop test clean logs dev prod monitoring

# Default target
help:
	@echo "Blocking Responses API - Docker Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make start       - Start API and web interface"
	@echo "  make dev         - Start in development mode (with logs)"
	@echo "  make prod        - Start in production mode"
	@echo "  make monitoring  - Start with monitoring (Prometheus + Grafana)"
	@echo "  make test        - Run test suite in container"
	@echo "  make logs        - Show container logs"
	@echo "  make stop        - Stop all services"
	@echo "  make clean       - Clean up containers and volumes"
	@echo "  make build       - Build containers"
	@echo "  make rebuild     - Force rebuild containers"
	@echo "  make shell       - Open shell in API container"
	@echo "  make health      - Check service health"

# Environment setup
.env:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Please edit .env and add your OpenAI API key"; \
	fi

# Build containers
build: .env
	docker-compose build

# Force rebuild
rebuild: .env
	docker-compose build --no-cache

# Start basic services
start: .env
	docker-compose up -d api web
	@echo "Services starting at:"
	@echo "  Web Interface: http://localhost:3000"
	@echo "  API: http://localhost:8000"

# Development mode (with logs)
dev: .env
	docker-compose up api web

# Production mode
prod: .env
	docker-compose up -d api web
	@make health

# Start with monitoring
monitoring: .env
	docker-compose --profile monitoring up -d
	@echo "Services available at:"
	@echo "  Web Interface: http://localhost:3000"
	@echo "  API: http://localhost:8000"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Grafana: http://localhost:3001"

# Run tests
test: .env
	docker-compose build api
	docker-compose run --rm api pytest test_app.py -v

# Run tests with coverage
test-coverage: .env
	docker-compose build api
	docker-compose run --rm api pytest test_app.py --cov=app --cov-report=html

# Show logs
logs:
	docker-compose logs -f

# Stop services
stop:
	docker-compose --profile monitoring --profile redis down

# Clean up everything
clean:
	docker-compose --profile monitoring --profile redis down -v --remove-orphans
	docker system prune -f

# Deep clean (including images)
clean-all:
	docker-compose --profile monitoring --profile redis down -v --remove-orphans --rmi all
	docker system prune -af --volumes

# Open shell in API container
shell:
	docker-compose exec api /bin/bash

# Check health
health:
	@echo "Checking service health..."
	@curl -f http://localhost:8000/health 2>/dev/null && echo "✓ API is healthy" || echo "✗ API is not responding"
	@curl -f http://localhost:3000/health 2>/dev/null && echo "✓ Web interface is healthy" || echo "✗ Web interface is not responding"

# Show status
status:
	docker-compose ps

# Update containers (pull latest images)
update:
	docker-compose pull
	docker-compose up -d

# Backup data (if using volumes)
backup:
	@mkdir -p backups
	@echo "Backing up Redis data..."
	docker run --rm -v blocking-responses-poc_redis_data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/redis-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@echo "Backing up Prometheus data..."
	docker run --rm -v blocking-responses-poc_prometheus_data:/data -v $(PWD)/backups:/backup alpine tar czf /backup/prometheus-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Quick demo
demo: start
	@echo "Waiting for services to start..."
	@sleep 5
	@echo "Running demo client..."
	docker-compose exec api python example_client.py

# Performance test
perf-test:
	@echo "Running performance test..."
	docker-compose exec api python -c "
import asyncio
import time
from example_client import BlockingResponsesClient

async def perf_test():
    client = BlockingResponsesClient()
    start = time.time()
    tasks = []
    for i in range(10):
        tasks.append(client.stream_chat(f'Test message {i}'))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    end = time.time()
    
    print(f'Completed 10 concurrent requests in {end-start:.2f}s')
    print(f'Average: {(end-start)/10:.2f}s per request')

asyncio.run(perf_test())
"