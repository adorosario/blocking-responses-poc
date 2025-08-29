#!/bin/bash

# Railway startup script with proper port handling
PORT=${PORT:-8000}

echo "Starting server on port $PORT"
uvicorn app:app --host 0.0.0.0 --port $PORT