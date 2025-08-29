#!/usr/bin/env python3
"""
Simplified Railway deployment version - API only without frontend
"""
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Simple health check app for Railway
app = FastAPI(title="Blocking Responses API", version="1.2.0")

@app.get("/")
async def root():
    return {"message": "Blocking Responses API", "status": "running"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "blocking-responses-api"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)