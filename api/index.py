# Vercel Python serverless entrypoint
# Vercel looks for `app` in api/index.py by default.
# We simply re-export the FastAPI app from backend/main.py.
import sys
import os

# Ensure the project root is on the Python path so all imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: F401 — Vercel picks up `app`
