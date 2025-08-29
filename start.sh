#!/bin/bash

# Railway startup script with proper port handling and debugging
PORT=${PORT:-8000}

echo "=== Railway Startup Debug ==="
echo "Environment variables:"
echo "PORT=${PORT}"
echo "OPENAI_API_KEY=${OPENAI_API_KEY:+PRESENT}"
echo "Working directory: $(pwd)"
echo "Python version: $(python --version 2>/dev/null || echo 'Python not found')"
echo "Contents of /app:"
ls -la /app/
echo "Static files check:"
ls -la /app/static/ 2>/dev/null || echo "No static directory"
ls -la /app/static/frontend/ 2>/dev/null || echo "No static/frontend directory"

echo "Starting server on port $PORT"
exec uvicorn app:app --host 0.0.0.0 --port $PORT --log-level debug