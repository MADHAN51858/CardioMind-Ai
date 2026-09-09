import os
import sys

if __name__ == "__main__":
    # Ensure app directory is on sys.path
    app_dir = os.path.dirname(os.path.abspath(__file__))
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)

    # Railway assigns dynamic PORT or defaults to 8000 / 8080
    port_env = os.environ.get("PORT") or os.environ.get("RAILWAY_PORT") or "8000"
    try:
        port = int(port_env)
    except (ValueError, TypeError):
        port = 8000

    print(f"==================================================", flush=True)
    print(f"[CARDIOMIND-STARTUP] Python: {sys.version}", flush=True)
    print(f"[CARDIOMIND-STARTUP] Detected PORT: {port}", flush=True)
    print(f"[CARDIOMIND-STARTUP] Working Directory: {os.getcwd()}", flush=True)
    print(f"==================================================", flush=True)

    import uvicorn
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )

