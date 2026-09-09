import os
import sys

if __name__ == "__main__":
    # Ensure app directory is on sys.path
    app_dir = os.path.dirname(os.path.abspath(__file__))
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)

    port_raw = os.environ.get("PORT", "8000")
    try:
        port = int(port_raw)
    except (ValueError, TypeError):
        port = 8000

    print(f"[CARDIOMIND-STARTUP] Launching Uvicorn on 0.0.0.0:{port}...", flush=True)
    import uvicorn
    uvicorn.run("server.main:app", host="0.0.0.0", port=port, log_level="info", access_log=True)
