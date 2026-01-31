import os
from dotenv import load_dotenv


def load_config() -> dict:
    load_dotenv()
    return {
        "ENV": os.getenv("ENV", "dev"),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
    }
