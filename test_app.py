from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"


def test_config_endpoint():
    response = client.get("/config")
    assert response.status_code == 200
    data = response.json()
    assert "default_model" in data


def test_risk_assessment_endpoint():
    response = client.post("/assess-risk", params={"text": "Hello world"})
    assert response.status_code == 200
    data = response.json()
    assert "pattern_score" in data
    assert "blocked" in data
