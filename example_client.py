#!/usr/bin/env python3
"""
Example client for the Blocking Responses API

This demonstrates how to interact with the streaming API and handle
both safe and blocked responses.
"""

import asyncio
import aiohttp
import json
import sys
from typing import AsyncGenerator


class BlockingResponsesClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url

    async def stream_chat(self, message: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream chat response with content filtering"""
        url = f"{self.base_url}/chat/stream"

        payload = {"message": message, **kwargs}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error_data = await response.json()
                    raise Exception(f"API Error: {error_data}")

                async for line in response.content:
                    line = line.decode("utf-8").strip()
                    if line.startswith("data: "):
                        data = line[6:]  # Remove 'data: ' prefix
                        if data == "[DONE]":
                            break
                        elif data == "[BLOCKED]":
                            yield "\n[RESPONSE WAS BLOCKED BY SAFETY FILTERS]\n"
                            break
                        elif data == "[ERROR]":
                            yield "\n[ERROR OCCURRED DURING PROCESSING]\n"
                            break
                        else:
                            yield data

    async def assess_risk(self, text: str) -> dict:
        """Assess risk of text without streaming"""
        url = f"{self.base_url}/assess-risk"

        async with aiohttp.ClientSession() as session:
            async with session.post(url, params={"text": text}) as response:
                if response.status != 200:
                    raise Exception(f"API Error: {response.status}")
                return await response.json()

    async def get_metrics(self) -> dict:
        """Get system metrics"""
        url = f"{self.base_url}/metrics"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"API Error: {response.status}")
                return await response.json()

    async def get_health(self) -> dict:
        """Check system health"""
        url = f"{self.base_url}/health"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"API Error: {response.status}")
                return await response.json()


async def demo_safe_conversation():
    """Demonstrate a safe conversation"""
    print("=== Safe Conversation Demo ===")
    client = BlockingResponsesClient()

    message = "What's the weather like today?"
    print(f"User: {message}")
    print("Assistant: ", end="", flush=True)

    async for chunk in client.stream_chat(message):
        print(chunk, end="", flush=True)
    print("\n")


async def demo_blocked_conversation():
    """Demonstrate a conversation that gets blocked"""
    print("=== Blocked Conversation Demo ===")
    client = BlockingResponsesClient()

    # This should trigger the SSN pattern and get blocked
    message = "My social security number is 123-45-6789, can you help me with taxes?"
    print(f"User: {message}")
    print("Assistant: ", end="", flush=True)

    async for chunk in client.stream_chat(message):
        print(chunk, end="", flush=True)
    print("\n")


async def demo_risk_assessment():
    """Demonstrate risk assessment"""
    print("=== Risk Assessment Demo ===")
    client = BlockingResponsesClient()

    test_texts = [
        "What's the weather like?",
        "My email is test@example.com",
        "My SSN is 123-45-6789",
        "Call me at (555) 123-4567",
        "My password is secret123",
        "Contact me at john@example.com or call (555) 123-4567 with your password",
    ]

    for text in test_texts:
        risk = await client.assess_risk(text)
        print(f"Text: {text}")
        print(f"  Risk Score: {risk['score']:.2f}")
        print(f"  Blocked: {risk['blocked']}")
        print(
            f"  Rules: {', '.join(risk['triggered_rules']) if risk['triggered_rules'] else 'None'}"
        )
        print()


async def demo_custom_parameters():
    """Demonstrate custom streaming parameters"""
    print("=== Custom Parameters Demo ===")
    client = BlockingResponsesClient()

    # Use higher threshold to allow emails through
    message = "You can reach me at contact@example.com for more information"
    print(f"User: {message}")
    print("Assistant (with high threshold): ", end="", flush=True)

    async for chunk in client.stream_chat(
        message,
        risk_threshold=2.0,  # Higher than email score (0.5)
        delay_tokens=10,  # Smaller buffer
        delay_ms=100,  # Faster flush
    ):
        print(chunk, end="", flush=True)
    print("\n")


async def demo_metrics():
    """Demonstrate metrics retrieval"""
    print("=== Metrics Demo ===")
    client = BlockingResponsesClient()

    try:
        metrics = await client.get_metrics()
        print("System Metrics:")
        print(f"  Total Requests: {metrics['total_requests']}")
        print(f"  Blocked Requests: {metrics['blocked_requests']}")
        print(f"  Block Rate: {metrics['block_rate']:.2%}")
        print(f"  Judge Calls: {metrics['judge_calls']}")
        print(f"  Average Delay: {metrics['avg_delay_ms']:.1f}ms")
        print(f"  Average Risk Score: {metrics['avg_risk_score']:.3f}")
        print()
    except Exception as e:
        print(f"Error getting metrics: {e}")


async def interactive_mode():
    """Interactive chat mode"""
    print("=== Interactive Mode ===")
    print("Type your messages (or 'quit' to exit):")

    client = BlockingResponsesClient()

    while True:
        try:
            message = input("\nYou: ").strip()
            if message.lower() in ["quit", "exit", "q"]:
                break

            if not message:
                continue

            print("Assistant: ", end="", flush=True)
            async for chunk in client.stream_chat(message):
                print(chunk, end="", flush=True)
            print()

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\nError: {e}")


async def main():
    """Main demo function"""
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        await interactive_mode()
        return

    try:
        # Check if server is running
        client = BlockingResponsesClient()
        health = await client.get_health()
        print(f"Connected to API (Status: {health['status']})\n")

        # Run all demos
        await demo_safe_conversation()
        await demo_blocked_conversation()
        await demo_risk_assessment()
        await demo_custom_parameters()
        await demo_metrics()

        print("Demo completed! Run with 'interactive' argument for interactive mode:")
        print("python example_client.py interactive")

    except Exception as e:
        print(f"Error connecting to API: {e}")
        print("Make sure the server is running: uvicorn app:app --reload")


if __name__ == "__main__":
    asyncio.run(main())

