import requests
import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def ask_ai(messages):
    url = "https://api.groq.com/openai/v1/chat/completions"

    res = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "llama3-8b-8192",
            "messages": [
                {
                    "role": "system",
                    "content": """
You are SkyBook AI, a professional flight booking agent.
Keep answers short and helpful.
"""
                },
                *messages
            ],
            "temperature": 0.7,
        },
    )

    data = res.json()

    print("DEBUG:", data)  # 👈 add this

    return data["choices"][0]["message"]["content"]
