# Simple test file to pass CI
import pytest
from httpx import AsyncClient
from app import app


@pytest.fixture
def client():
    return AsyncClient(app=app, base_url="http://test")


class TestBasicAPI:
    """Test basic API functionality"""

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_config_endpoint(self, client):
        response = await client.get("/config")
        assert response.status_code == 200
        data = response.json()
        assert "openai_configured" in data

    @pytest.mark.asyncio
    async def test_risk_assessment_endpoint(self, client):
        response = await client.post("/assess-risk?text=Hello world")
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert data["score"] >= 0.0
