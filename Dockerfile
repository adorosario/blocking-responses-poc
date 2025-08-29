# Frontend build stage
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Main application stage
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including curl for health checks
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    python -m spacy download en_core_web_lg

# Copy application code
COPY app.py .
COPY test_app.py .
COPY test_app_basic.py .
COPY example_client.py .
COPY start.sh .
COPY static/ ./static/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./static/frontend/

# Make startup script executable and create non-root user
RUN chmod +x start.sh && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check - use PORT environment variable for Railway compatibility
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Default command - uses startup script for Railway compatibility
CMD ["./start.sh"]