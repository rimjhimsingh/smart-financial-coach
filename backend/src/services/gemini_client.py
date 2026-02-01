"""
Gemini Client Factory
--------------------
This module provides a single, centralized way to create a Gemini API client.

Purpose:
- Reads the Gemini API key from environment variables.
- Ensures the application fails fast with a clear error if the key is missing.
- Returns a configured google.genai.Client instance for use by AI services.

This abstraction keeps API key handling out of route and service logic and makes
it easy to swap configuration or extend client setup in the future.
"""
import os
from google import genai

def get_gemini_client() -> genai.Client:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=key)
