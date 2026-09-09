import os
import uuid
import json
import sqlite3
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING

_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_ROOT_DIR, ".env")
load_dotenv(_ENV_PATH, override=True)
load_dotenv(override=True)

logger = logging.getLogger("chat_db")

MONGO_URI = os.getenv("MONGO_URI", "").strip()
MONGO_DB_NAME = "cardiomind"

mongo_client = None
mongo_db = None

if MONGO_URI:
    try:
        import certifi
        mongo_client = MongoClient(
            MONGO_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        mongo_db = mongo_client[MONGO_DB_NAME]
        mongo_client.admin.command("ping")
        mongo_db.channels.create_index([("id", ASCENDING)], unique=True)
        mongo_db.channels.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        mongo_db.messages.create_index([("channel_id", ASCENDING), ("created_at", ASCENDING)])
        logger.info(f"[chat_db] Connected to MongoDB Atlas ({MONGO_DB_NAME}) for chat from .env")
    except Exception as e:
        try:
            mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
            mongo_db = mongo_client[MONGO_DB_NAME]
            mongo_client.admin.command("ping")
            mongo_db.channels.create_index([("id", ASCENDING)], unique=True)
            mongo_db.channels.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
            mongo_db.messages.create_index([("channel_id", ASCENDING), ("created_at", ASCENDING)])
            logger.info(f"[chat_db] Connected to MongoDB Atlas ({MONGO_DB_NAME}) for chat from .env")
        except Exception as e2:
            logger.warning(f"[chat_db] MongoDB connection notice ({e2}). Using local SQLite fallback.")
            mongo_db = None

# Fallback SQLite DB
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_DIR = "/tmp"

def _resolve_db_path(filename: str) -> str:
    if os.access(_BACKEND_DIR, os.W_OK):
        return os.path.join(_BACKEND_DIR, filename)
    return os.path.join(_TMP_DIR, filename)

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
    except Exception as e:
        logger.warning(f"[chat_db] SQLite fallback init warning: {e}")
        _db_available = False

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

    if mongo_db is not None:
        try:
            mongo_db.channels.insert_one({
                "id": channel_id,
                "user_id": user_id,
                "title": title,
                "created_at": now_str,
                "updated_at": now_str
            })
            return channel_id
        except Exception as e:
            logger.error(f"[MongoDB] Error creating channel: {e}")

    conn = _get_conn()
    if conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO channels (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (channel_id, user_id, title, now_str, now_str)
        )
        conn.commit()
        conn.close()
    return channel_id


async def get_channels_for_user(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve chat channels for user."""
    if mongo_db is not None:
        try:
            cursor = mongo_db.channels.find({"user_id": user_id}).sort("updated_at", DESCENDING)
            channels = []
            for c in cursor:
                channels.append({
                    "id": c["id"],
                    "title": c["title"],
                    "created_at": c["created_at"],
                    "updated_at": c["updated_at"]
                })
            if not channels:
                cursor_all = mongo_db.channels.find().sort("updated_at", DESCENDING)
                for c in cursor_all:
                    channels.append({
                        "id": c["id"],
                        "title": c["title"],
                        "created_at": c["created_at"],
                        "updated_at": c["updated_at"]
                    })
            return channels
        except Exception as e:
            logger.error(f"[MongoDB] Error getting channels: {e}")

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
    if mongo_db is not None:
        try:
            mongo_db.channels.delete_one({"id": channel_id})
            mongo_db.messages.delete_many({"channel_id": channel_id})
            return True
        except Exception as e:
            logger.error(f"[MongoDB] Error deleting channel: {e}")

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
    sources_list = sources or []

    if mongo_db is not None:
        try:
            mongo_db.messages.insert_one({
                "id": msg_id,
                "channel_id": channel_id,
                "sender": sender,
                "text": text,
                "sources": sources_list,
                "created_at": now_str
            })
            mongo_db.channels.update_one(
                {"id": channel_id},
                {"$set": {"updated_at": now_str}}
            )
            return msg_id
        except Exception as e:
            logger.error(f"[MongoDB] Error saving message: {e}")

    conn = _get_conn()
    if conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (id, channel_id, sender, text, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, channel_id, sender, text, json.dumps(sources_list), now_str)
        )
        cursor.execute("UPDATE channels SET updated_at = ? WHERE id = ?", (now_str, channel_id))
        conn.commit()
        conn.close()
    return msg_id


async def get_messages_for_channel(channel_id: str) -> List[Dict[str, Any]]:
    """Retrieve all messages for a specific channel."""
    if mongo_db is not None:
        try:
            cursor = mongo_db.messages.find({"channel_id": channel_id}).sort("created_at", ASCENDING)
            messages = []
            for m in cursor:
                messages.append({
                    "id": m["id"],
                    "sender": m["sender"],
                    "text": m["text"],
                    "sources": m.get("sources", []),
                    "created_at": m["created_at"]
                })
            return messages
        except Exception as e:
            logger.error(f"[MongoDB] Error fetching messages: {e}")

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
