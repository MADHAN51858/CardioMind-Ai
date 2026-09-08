import os
import uuid
import json
import sqlite3
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("chat_db")

# On Vercel, the filesystem is read-only after deploy.
# We write to /tmp (ephemeral but writable) or the local backend/ dir.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

def _resolve_db_path(filename: str) -> str:
    if os.access(_BACKEND_DIR, os.W_OK):
        return os.path.join(_BACKEND_DIR, filename)
    return os.path.join("/tmp", filename)

SQLITE_DB_PATH = _resolve_db_path("chat.db")

_db_available = False

def init_sqlite_db():
    """Ensure local SQLite tables for chat channels and messages exist."""
    global _db_available
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                sources TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()
        _db_available = True
        logger.info(f"[chat_db] chat.db initialised at {SQLITE_DB_PATH}")
    except Exception as e:
        logger.warning(f"[chat_db] Could not initialise chat.db ({e}). Chat history will be session-only.")
        _db_available = False

# Initialize on module load
init_sqlite_db()


def _get_conn():
    if not _db_available:
        return None
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


async def create_channel(user_id: str, title: str) -> str:
    """Create a new chat channel."""
    channel_id = str(uuid.uuid4())
    now_str = datetime.utcnow().isoformat()
    conn = _get_conn()
    if conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO channels (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (channel_id, user_id, title, now_str, now_str)
        )
        conn.commit()
        conn.close()
    logger.info(f"Created chat channel {channel_id} for user {user_id}")
    return channel_id


async def get_channels_for_user(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve chat channels for user."""
    conn = _get_conn()
    if not conn:
        return []
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, title, created_at, updated_at FROM channels WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    if not rows:
        cursor.execute("SELECT id, title, created_at, updated_at FROM channels ORDER BY updated_at DESC")
        rows = cursor.fetchall()
    channels = [{"id": r["id"], "title": r["title"], "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]
    conn.close()
    return channels


async def delete_channel(channel_id: str) -> bool:
    """Delete a chat channel and all its associated messages."""
    conn = _get_conn()
    if not conn:
        return False
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE channel_id = ?", (channel_id,))
    cursor.execute("DELETE FROM channels WHERE id = ?", (channel_id,))
    conn.commit()
    conn.close()
    return True


async def save_message(channel_id: str, sender: str, text: str, sources: Optional[List[str]] = None) -> str:
    """Save a user or AI message to the database."""
    msg_id = str(uuid.uuid4())
    now_str = datetime.utcnow().isoformat()
    sources_json = json.dumps(sources or [])
    conn = _get_conn()
    if conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (id, channel_id, sender, text, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, channel_id, sender, text, sources_json, now_str)
        )
        cursor.execute("UPDATE channels SET updated_at = ? WHERE id = ?", (now_str, channel_id))
        conn.commit()
        conn.close()
    return msg_id


async def get_messages_for_channel(channel_id: str) -> List[Dict[str, Any]]:
    """Retrieve all messages for a specific channel."""
    conn = _get_conn()
    if not conn:
        return []
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, sender, text, sources, created_at FROM messages WHERE channel_id = ? ORDER BY created_at ASC",
        (channel_id,)
    )
    rows = cursor.fetchall()
    messages = []
    for r in rows:
        try:
            srcs = json.loads(r["sources"]) if r["sources"] else []
        except Exception:
            srcs = []
        messages.append({"id": r["id"], "sender": r["sender"], "text": r["text"], "sources": srcs, "created_at": r["created_at"]})
    conn.close()
    return messages
