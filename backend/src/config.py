"""
Application Configuration
-------------------------
This module centralizes runtime configuration for the backend.

What it does:
- Loads environment variables from a local .env file for development convenience.
- Exposes load_config which returns a dictionary of configuration values consumed by the app
  factory and other modules.

What is configured here:
- ENV: The runtime environment name (for example dev or prod) used for behavior toggles.
- GEMINI_API_KEY: The API key used by the Gemini client factory to call the model.
"""
import os
from dotenv import load_dotenv


def load_config() -> dict:
    load_dotenv()

    return {
        "ENV": os.getenv("ENV", "dev"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
        "GEMINI_MODEL": os.getenv("GEMINI_MODEL", "gemma-3-27b-it"),
        "INSIGHTS_CACHE_TTL_SEC": int(os.getenv("INSIGHTS_CACHE_TTL_SEC", "21600")),
    }
