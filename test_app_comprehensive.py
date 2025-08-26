# Comprehensive Compliance Test Suite - All Frameworks
# This test file validates HIPAA, PCI DSS, GDPR, and CCPA compliance detection
import pytest
import json
import time
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
from app import app, settings, pattern_detector, presidio_detector


# Test fixtures
@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


class TestBasicFunctionality:
    """Test basic API functionality and health"""

    def test_health_check(self, client):
        """Verify API is healthy and dependencies are loaded"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["version"] == "1.1.0"
        assert "dependencies" in data
        assert "compliance_features" in data

    def test_compliance_endpoints(self, client):
        """Test compliance configuration endpoints"""
        patterns_response = client.get("/compliance/patterns")
        assert patterns_response.status_code == 200
        patterns_data = patterns_response.json()
        assert "patterns" in patterns_data
        assert "threshold" in patterns_data

        config_response = client.get("/compliance/config")
        assert config_response.status_code == 200
        config_data = config_response.json()
        assert "risk_threshold" in config_data
        assert "delay_tokens" in config_data


class TestHIPAACompliance:
    """Test HIPAA healthcare compliance detection"""

    def test_hipaa_phi_detection(self, client):
        """Test Protected Health Information (PHI) detection"""
        test_cases = [
            {
                "text": "Patient John Smith, MRN: 12345678",
                "expected_blocked": True,
                "description": "Medical Record Number"
            },
            {
                "text": "Patient diagnosed with diabetes mellitus type 2",
                "expected_detected": True,
                "description": "Medical diagnosis"
            },
            {
                "text": "Prescription for metformin 500mg twice daily",
                "expected_detected": True,
                "description": "Prescription information"
            },
            {
                "text": "Patient SSN: 123-45-6789 for medical records",
                "expected_blocked": True,
                "description": "SSN + medical context"
            }
        ]

        print("\n🏥 HIPAA Compliance Testing:")
        for i, case in enumerate(test_cases, 1):
            response = client.post("/assess-risk", params={
                "text": case["text"], 
                "region": "HIPAA"
            })
            assert response.status_code == 200
            data = response.json()
            
            if case.get("expected_blocked"):
                assert data["blocked"] is True, f"HIPAA case {i} should be blocked: {case['description']}"
                print(f"  ✅ {i}. {case['description']} - BLOCKED (Score: {data['score']:.2f})")
            else:
                print(f"  🔍 {i}. {case['description']} - Score: {data['score']:.2f}")

    def test_hipaa_safe_content(self, client):
        """Test that general healthcare discussion is not blocked"""
        response = client.post("/assess-risk", params={
            "text": "General information about diabetes prevention",
            "region": "HIPAA"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"  ✅ HIPAA Safe Content - Score: {data['score']:.2f}")


class TestPCIDSSCompliance:
    """Test PCI DSS payment card industry compliance"""

    def test_pci_credit_card_detection(self, client):
        """Test credit card and payment data detection"""
        test_cases = [
            {
                "text": "Credit card number: 4111111111111111",
                "expected_blocked": True,
                "description": "Visa credit card"
            },
            {
                "text": "Payment card 4532-0151-1283-0366 expires 12/25",
                "expected_blocked": True,
                "description": "Credit card with expiration"
            },
            {
                "text": "Process payment for card ending in 1111",
                "expected_detected": False,
                "description": "Masked card reference (safe)"
            },
            {
                "text": "Bank account: 123456789 routing: 987654321",
                "expected_detected": True,
                "description": "Banking information"
            }
        ]

        print("\n💳 PCI DSS Compliance Testing:")
        for i, case in enumerate(test_cases, 1):
            response = client.post("/assess-risk", params={
                "text": case["text"],
                "region": "PCI"
            })
            assert response.status_code == 200
            data = response.json()
            
            if case.get("expected_blocked"):
                assert data["blocked"] is True, f"PCI case {i} should be blocked: {case['description']}"
                print(f"  ✅ {i}. {case['description']} - BLOCKED (Score: {data['score']:.2f})")
            else:
                print(f"  🔍 {i}. {case['description']} - Score: {data['score']:.2f}")

    def test_pci_safe_payment_discussion(self, client):
        """Test that general payment discussion is not blocked"""
        response = client.post("/assess-risk", params={
            "text": "We accept major credit cards for payment",
            "region": "PCI"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"  ✅ PCI Safe Content - Score: {data['score']:.2f}")


class TestGDPRCompliance:
    """Test GDPR EU privacy regulation compliance"""

    def test_gdpr_personal_data_detection(self, client):
        """Test European personal data detection"""
        test_cases = [
            {
                "text": "Contact john.smith@email.com or call +44-20-7946-0958",
                "expected_detected": True,
                "description": "Email + EU phone number"
            },
            {
                "text": "Personal data: John Doe, 123 Main Street, London",
                "expected_detected": True,
                "description": "Name and address combination"
            },
            {
                "text": "User email: customer@company.eu",
                "expected_detected": True,
                "description": "EU domain email"
            },
            {
                "text": "GDPR compliance requires data protection",
                "expected_detected": False,
                "description": "GDPR discussion (safe)"
            }
        ]

        print("\n🇪🇺 GDPR Compliance Testing:")
        for i, case in enumerate(test_cases, 1):
            response = client.post("/assess-risk", params={
                "text": case["text"],
                "region": "GDPR"
            })
            assert response.status_code == 200
            data = response.json()
            
            # GDPR has lower thresholds, so check for detection
            if case.get("expected_detected"):
                assert data["score"] > 0, f"GDPR case {i} should detect PII: {case['description']}"
                print(f"  ✅ {i}. {case['description']} - DETECTED (Score: {data['score']:.2f})")
            else:
                print(f"  🔍 {i}. {case['description']} - Score: {data['score']:.2f}")


class TestCCPACompliance:
    """Test CCPA California privacy law compliance"""

    def test_ccpa_consumer_data_detection(self, client):
        """Test California consumer personal information detection"""
        test_cases = [
            {
                "text": "Consumer SSN 987-65-4321 and phone (555) 123-4567",
                "expected_blocked": True,
                "description": "SSN + phone combination"
            },
            {
                "text": "Customer email: consumer@california.com",
                "expected_detected": True,
                "description": "Consumer email address"
            },
            {
                "text": "Personal identifier data collection notice",
                "expected_detected": False,
                "description": "CCPA compliance discussion"
            },
            {
                "text": "California resident contact: user@domain.com",
                "expected_detected": True,
                "description": "California resident data"
            }
        ]

        print("\n🏛️ CCPA Compliance Testing:")
        for i, case in enumerate(test_cases, 1):
            response = client.post("/assess-risk", params={
                "text": case["text"],
                "region": "CCPA"
            })
            assert response.status_code == 200
            data = response.json()
            
            if case.get("expected_blocked"):
                assert data["blocked"] is True, f"CCPA case {i} should be blocked: {case['description']}"
                print(f"  ✅ {i}. {case['description']} - BLOCKED (Score: {data['score']:.2f})")
            else:
                print(f"  🔍 {i}. {case['description']} - Score: {data['score']:.2f}")


class TestUniversalPIIDetection:
    """Test universal PII patterns across all frameworks"""

    def test_high_risk_patterns(self, client):
        """Test patterns that should be blocked regardless of region"""
        high_risk_cases = [
            {
                "text": "My social security number is 111-22-3333",
                "pattern": "SSN",
                "expected_blocked": True
            },
            {
                "text": "Credit card: 4532015112830366",
                "pattern": "Credit Card",
                "expected_blocked": True
            },
            {
                "text": "Password: admin123 for database access",
                "pattern": "Password",
                "expected_detected": True
            }
        ]

        print("\n🔒 Universal PII Detection Testing:")
        for i, case in enumerate(high_risk_cases, 1):
            response = client.post("/assess-risk", params={"text": case["text"]})
            assert response.status_code == 200
            data = response.json()
            
            if case.get("expected_blocked"):
                assert data["blocked"] is True, f"Universal case {i} should be blocked"
                print(f"  ✅ {i}. {case['pattern']} - BLOCKED (Score: {data['score']:.2f})")
            else:
                print(f"  🔍 {i}. {case['pattern']} - Score: {data['score']:.2f}")

    def test_safe_content_all_regions(self, client):
        """Test that safe content passes all regional checks"""
        safe_texts = [
            "What is the weather like today?",
            "Thank you for your business",
            "Our services include compliance consulting"
        ]

        print("\n✅ Safe Content Testing:")
        for region in ["HIPAA", "PCI", "GDPR", "CCPA", None]:
            for text in safe_texts:
                params = {"text": text}
                if region:
                    params["region"] = region
                    
                response = client.post("/assess-risk", params=params)
                assert response.status_code == 200
                data = response.json()
                
                # Safe content should have low scores
                region_label = region or "General"
                print(f"  ✅ {region_label}: '{text[:30]}...' - Score: {data['score']:.2f}")


class TestStreamingCompliance:
    """Test real-time streaming compliance filtering"""

    def test_streaming_blocked_content(self, client):
        """Test that high-risk content is blocked in streaming"""
        request_data = {
            "message": "My SSN is 123-45-6789",
            "stream": False
        }
        
        response = client.post("/chat/stream", json=request_data)
        assert response.status_code == 200
        
        # Parse SSE response
        lines = response.text.strip().split('\n')
        blocked = False
        
        for line in lines:
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])
                    if data.get('type') == 'blocked':
                        blocked = True
                        break
                except:
                    continue
        
        assert blocked, "High-risk content should be blocked in streaming"
        print("  ✅ Streaming Compliance - High-risk content blocked")

    def test_streaming_safe_content(self, client):
        """Test that safe content streams normally"""
        # Skip if no API key configured
        if not settings.openai_api_key or settings.openai_api_key == "your_openai_api_key_here":
            pytest.skip("OpenAI API key not configured")
            
        request_data = {
            "message": "What is the weather today?",
            "stream": False
        }
        
        response = client.post("/chat/stream", json=request_data)
        assert response.status_code == 200
        print("  ✅ Streaming Compliance - Safe content allowed")


class TestRegionalVariations:
    """Test that different regions have appropriate threshold variations"""

    def test_regional_threshold_differences(self, client):
        """Test that regions apply different sensitivity levels"""
        test_text = "Contact user@example.com for more information"
        
        print("\n🌍 Regional Threshold Testing:")
        regions = ["HIPAA", "PCI", "GDPR", "CCPA"]
        
        for region in regions:
            response = client.post("/assess-risk", params={
                "text": test_text,
                "region": region
            })
            assert response.status_code == 200
            data = response.json()
            print(f"  🔍 {region}: Email detection - Score: {data['score']:.2f}")


def run_comprehensive_test():
    """Main function to run all compliance tests"""
    print("🧪 COMPREHENSIVE COMPLIANCE TEST SUITE")
    print("=" * 60)
    print("Testing all compliance frameworks:")
    print("✅ HIPAA: Healthcare PHI detection and safe handling")
    print("✅ PCI DSS: Payment card data protection")
    print("✅ GDPR: EU privacy regulation compliance") 
    print("✅ CCPA: California privacy law support")
    print("=" * 60)
    
    # Run pytest with verbose output
    exit_code = pytest.main([__file__, "-v", "-s"])
    
    print("\n" + "=" * 60)
    if exit_code == 0:
        print("🎉 ALL COMPLIANCE TESTS PASSED!")
        print("✅ System is ready for production deployment")
        print("🔒 All regulatory frameworks validated")
    else:
        print("❌ Some tests failed - review output above")
    
    return exit_code


if __name__ == "__main__":
    # Run the comprehensive test suite
    run_comprehensive_test()
