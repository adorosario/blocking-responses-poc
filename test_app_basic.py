# Basic test suite for blocking responses API
import pytest
import json
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
from app import app, settings, pattern_detector, presidio_detector


# Test fixtures
@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    return TestClient(app)


class TestBasicFunctionality:
    """Test basic API functionality"""

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["version"] == "1.1.0"

    def test_compliance_patterns_endpoint(self, client):
        response = client.get("/compliance/patterns")
        assert response.status_code == 200
        data = response.json()
        assert "patterns" in data
        assert "threshold" in data

    def test_compliance_config_endpoint(self, client):
        response = client.get("/compliance/config")
        assert response.status_code == 200
        data = response.json()
        assert "risk_threshold" in data
        assert "delay_tokens" in data


class TestPatternDetection:
    """Test the pattern detection system"""

    def test_email_detection(self):
        result = pattern_detector.assess_compliance_risk(
            "Contact me at john.doe@example.com"
        )
        assert result.score > 0
        assert not result.blocked  # Below default threshold
        assert len(result.triggered_rules) > 0
        assert any("email" in rule for rule in result.triggered_rules)

    def test_ssn_detection(self):
        result = pattern_detector.assess_compliance_risk("My SSN is 123-45-6789")
        assert result.score >= 1.0
        assert result.blocked  # Should block SSN
        assert len(result.triggered_rules) > 0
        assert any("ssn" in rule for rule in result.triggered_rules)

    def test_phone_detection(self):
        result = pattern_detector.assess_compliance_risk("Call me at (555) 123-4567")
        assert result.score > 0
        assert not result.blocked  # Below threshold
        assert len(result.triggered_rules) > 0
        assert any("phone" in rule for rule in result.triggered_rules)

    def test_safe_content(self):
        result = pattern_detector.assess_compliance_risk("What is the weather today?")
        assert result.score == 0.0
        assert not result.blocked
        assert len(result.triggered_rules) == 0


class TestRiskAssessment:
    """Test risk assessment endpoint"""

    def test_assess_risk_safe_content(self, client):
        response = client.post("/assess-risk", params={"text": "What is the weather?"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_score"] == 0.0
        assert data["blocked"] is False
        assert len(data["triggered_rules"]) == 0

    def test_assess_risk_email(self, client):
        response = client.post(
            "/assess-risk", params={"text": "My email is test@example.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_score"] > 0
        # With tuned sensitivity, email is detected but not blocked (score < 1.0)
        assert data["blocked"] is False
        assert data["score"] < 1.0  # Combined pattern + presidio score below threshold
        assert data["score"] > 0.5  # But still detects the email
        assert len(data["triggered_rules"]) > 0
        assert len(data["presidio_entities"]) > 0

    def test_assess_risk_ssn(self, client):
        response = client.post("/assess-risk", params={"text": "My SSN is 123-45-6789"})
        assert response.status_code == 200
        data = response.json()
        assert data["pattern_score"] >= 1.0
        assert data["blocked"] is True
        assert len(data["triggered_rules"]) > 0


class TestStreamingEndpoint:
    """Test streaming functionality"""

    def test_chat_stream_no_api_key(self, client):
        """Test that streaming fails when no API key is provided"""
        with patch("app.settings.openai_api_key", ""):
            request_data = {"message": "Hello"}
            response = client.post("/chat/stream", json=request_data)
            # Should fail with 400 when no API key is provided
            assert response.status_code == 400
            assert "OpenAI API key is required" in response.json()["detail"]

    def test_chat_stream_validation(self, client):
        # Test empty message
        request_data = {"message": ""}
        response = client.post("/chat/stream", json=request_data)
        assert response.status_code == 422

        # Test message too long
        request_data = {"message": "a" * 10001}
        response = client.post("/chat/stream", json=request_data)
        assert response.status_code == 422

        # Test invalid parameters
        request_data = {"message": "Hello", "delay_tokens": 200}  # Too high
        response = client.post("/chat/stream", json=request_data)
        assert response.status_code == 422

    def test_legacy_get_endpoint(self, client):
        response = client.get("/chat/stream?q=Hello")
        # Legacy endpoint should work if API key is configured
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


class TestPresidioIntegration:
    """Test Presidio integration"""

    def test_presidio_initialization(self):
        # Test that presidio_detector initializes properly
        assert presidio_detector is not None

    def test_presidio_analysis_no_entities(self):
        score, entities = presidio_detector.analyze_text("Hello world")
        assert score >= 0
        assert isinstance(entities, list)

    def test_presidio_analysis_with_email(self):
        score, entities = presidio_detector.analyze_text("Contact john@example.com")
        # Results depend on Presidio availability
        assert isinstance(score, float)
        assert isinstance(entities, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

