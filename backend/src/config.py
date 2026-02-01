import os
from dotenv import load_dotenv


def load_config() -> dict:
    load_dotenv()

    return {
        "ENV": os.getenv("ENV", "dev"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
    }
