import sqlite3
import os
import logging

logger = logging.getLogger("database")

# On Vercel, the filesystem is read-only. We try to use a writable /tmp path,
# falling back to in-memory mode if even /tmp fails.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_DIR = "/tmp"

def _resolve_db_path(filename: str) -> str:
    """Pick a writable location for the SQLite DB file."""
    # Prefer the original backend/ location (works locally)
    local_path = os.path.join(_BACKEND_DIR, filename)
    if os.access(_BACKEND_DIR, os.W_OK):
        return local_path
    # Fall back to /tmp (writable on Vercel serverless)
    return os.path.join(_TMP_DIR, filename)

DB_FILE = _resolve_db_path("users.db")

_db_available = False  # tracks whether SQLite init succeeded

def init_db():
    global _db_available
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()
        _db_available = True
        logger.info(f"[DB] users.db initialised at {DB_FILE}")
    except Exception as e:
        logger.warning(f"[DB] Could not initialise users.db ({e}). Auth features disabled.")
        _db_available = False

def get_db_connection():
    if not _db_available:
        return None
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def get_user_by_username(username: str):
    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return user

def create_user(username: str, hashed_password: str):
    conn = get_db_connection()
    if conn is None:
        return False
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, hashed_password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()
