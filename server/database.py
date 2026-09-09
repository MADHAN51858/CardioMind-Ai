import sqlite3
import os
import re
import json
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING

load_dotenv()

logger = logging.getLogger("database")

MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB_NAME = "cardiomind"

mongo_client = None
mongo_db = None

# Initialize MongoDB Atlas connection
if MONGO_URI:
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_db = mongo_client[MONGO_DB_NAME]
        # Verify connection
        mongo_client.admin.command("ping")
        # Setup unique and query indexes
        mongo_db.users.create_index([("username", ASCENDING)], unique=True)
        mongo_db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)
        mongo_db.password_resets.create_index([("token", ASCENDING)], unique=True)
        mongo_db.password_resets.create_index([("email", ASCENDING)])
        mongo_db.reports.create_index([("id", ASCENDING)], unique=True)
        mongo_db.reports.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        logger.info(f"[DB] Connected to MongoDB Atlas ({MONGO_DB_NAME})")
    except Exception as e:
        logger.warning(f"[DB] MongoDB Atlas connection error ({e}). Using local SQLite.")
        mongo_db = None

# Fallback SQLite DB
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_TMP_DIR = "/tmp"

def _resolve_db_path(filename: str) -> str:
    local_path = os.path.join(_BACKEND_DIR, filename)
    if os.access(_BACKEND_DIR, os.W_OK):
        return local_path
    return os.path.join(_TMP_DIR, filename)

DB_FILE = _resolve_db_path("chat.db")
_db_available = False

def init_db():
    global _db_available
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                hashed_password TEXT NOT NULL,
                full_name TEXT,
                created_at TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                otp TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                pdf_url TEXT NOT NULL,
                category TEXT,
                probability REAL,
                age REAL,
                sex INTEGER,
                trestbps REAL,
                chol REAL,
                patient_data TEXT,
                prediction_data TEXT
            )
        ''')
        conn.commit()
        conn.close()
        _db_available = True
    except Exception as e:
        logger.warning(f"[DB] SQLite fallback init warning: {e}")
        _db_available = False

init_db()

def get_db_connection():
    if not _db_available:
        init_db()
    if not _db_available:
        return None
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def migrate_sqlite_to_mongodb():
    """Migrate existing users, password resets, and reports from local SQLite to MongoDB Atlas."""
    if mongo_db is None:
        return
    conn = get_db_connection()
    if conn is None:
        return
    try:
        cursor = conn.cursor()
        # 1. Migrate users
        try:
            cursor.execute("SELECT * FROM users")
            users = cursor.fetchall()
            for u in users:
                user_dict = dict(u)
                uname = (user_dict.get("username") or "").strip()
                if not uname:
                    continue
                rgx = {"$regex": f"^{re.escape(uname)}$", "$options": "i"}
                existing = mongo_db.users.find_one({"username": rgx})
                if not existing:
                    doc = {
                        "username": uname,
                        "hashed_password": user_dict.get("hashed_password"),
                        "full_name": user_dict.get("full_name") or "",
                        "created_at": user_dict.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                    }
                    if user_dict.get("email"):
                        doc["email"] = user_dict["email"].strip()
                    mongo_db.users.insert_one(doc)
                    logger.info(f"[DB Migration] Migrated user '{uname}' to MongoDB Atlas.")
        except Exception as e:
            logger.warning(f"[DB Migration] Users migration notice: {e}")

        # 2. Migrate password resets
        try:
            cursor.execute("SELECT * FROM password_resets WHERE used = 0")
            resets = cursor.fetchall()
            for r in resets:
                r_dict = dict(r)
                token = r_dict.get("token")
                if token and not mongo_db.password_resets.find_one({"token": token}):
                    mongo_db.password_resets.insert_one({
                        "email": (r_dict.get("email") or "").strip(),
                        "otp": (r_dict.get("otp") or "").strip(),
                        "token": token.strip(),
                        "expires_at": r_dict.get("expires_at"),
                        "used": int(r_dict.get("used", 0)),
                        "created_at": r_dict.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                    })
        except Exception as e:
            logger.warning(f"[DB Migration] Password resets migration notice: {e}")

        # 3. Migrate reports
        try:
            cursor.execute("SELECT * FROM reports")
            reports = cursor.fetchall()
            for rep in reports:
                rep_dict = dict(rep)
                rep_id = str(rep_dict.get("id"))
                if rep_id and not mongo_db.reports.find_one({"id": rep_id}):
                    mongo_db.reports.insert_one({
                        "id": rep_id,
                        "user_id": rep_dict.get("user_id") or "guest",
                        "created_at": rep_dict.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                        "pdf_url": rep_dict.get("pdf_url") or "",
                        "category": rep_dict.get("category") or "Unknown",
                        "probability": float(rep_dict.get("probability", 0.0)),
                        "age": float(rep_dict.get("age", 0.0)) if rep_dict.get("age") is not None else None,
                        "sex": int(rep_dict.get("sex", 0)) if rep_dict.get("sex") is not None else None,
                        "trestbps": float(rep_dict.get("trestbps", 0.0)) if rep_dict.get("trestbps") is not None else None,
                        "chol": float(rep_dict.get("chol", 0.0)) if rep_dict.get("chol") is not None else None,
                        "patient_data": json.loads(rep_dict.get("patient_data")) if rep_dict.get("patient_data") else {},
                        "prediction_data": json.loads(rep_dict.get("prediction_data")) if rep_dict.get("prediction_data") else {}
                    })
        except Exception as e:
            logger.warning(f"[DB Migration] Reports migration notice: {e}")

        # 4. Migrate channels and messages
        try:
            cursor.execute("SELECT * FROM channels")
            channels = cursor.fetchall()
            for ch in channels:
                ch_dict = dict(ch)
                ch_id = ch_dict.get("id")
                if ch_id and not mongo_db.channels.find_one({"id": ch_id}):
                    mongo_db.channels.insert_one({
                        "id": ch_id,
                        "user_id": ch_dict.get("user_id"),
                        "title": ch_dict.get("title"),
                        "created_at": ch_dict.get("created_at"),
                        "updated_at": ch_dict.get("updated_at")
                    })
            cursor.execute("SELECT * FROM messages")
            messages = cursor.fetchall()
            for msg in messages:
                m_dict = dict(msg)
                m_id = m_dict.get("id")
                if m_id and not mongo_db.messages.find_one({"id": m_id}):
                    sources = []
                    if m_dict.get("sources"):
                        try:
                            sources = json.loads(m_dict["sources"])
                        except Exception:
                            sources = []
                    mongo_db.messages.insert_one({
                        "id": m_id,
                        "channel_id": m_dict.get("channel_id"),
                        "sender": m_dict.get("sender"),
                        "text": m_dict.get("text"),
                        "sources": sources,
                        "created_at": m_dict.get("created_at")
                    })
        except Exception as e:
            logger.warning(f"[DB Migration] Chat migration notice: {e}")

    finally:
        conn.close()

# Run migration on module load if MongoDB is connected
if mongo_db is not None:
    try:
        migrate_sqlite_to_mongodb()
    except Exception as e:
        logger.warning(f"[DB] Initial migration error: {e}")

# ── User Account Operations ──────────────────────────────────────────────────

def get_user_by_username(username: str):
    if not username:
        return None
    username_clean = username.strip()
    if mongo_db is not None:
        try:
            doc = mongo_db.users.find_one({
                "username": {"$regex": f"^{re.escape(username_clean)}$", "$options": "i"}
            })
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception as e:
            logger.error(f"[MongoDB] Error getting user by username: {e}")

    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username_clean,))
    user = cursor.fetchone()
    conn.close()
    if user:
        user_dict = dict(user)
        if mongo_db is not None:
            try:
                mongo_db.users.update_one(
                    {"username": user_dict["username"]},
                    {"$set": user_dict},
                    upsert=True
                )
            except Exception:
                pass
        return user_dict
    return None

def get_user_by_email(email: str):
    if not email:
        return None
    email_clean = email.strip()
    if mongo_db is not None:
        try:
            doc = mongo_db.users.find_one({
                "email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}
            })
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception as e:
            logger.error(f"[MongoDB] Error getting user by email: {e}")

    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email_clean,))
    user = cursor.fetchone()
    conn.close()
    if user:
        user_dict = dict(user)
        if mongo_db is not None:
            try:
                mongo_db.users.update_one(
                    {"username": user_dict["username"]},
                    {"$set": user_dict},
                    upsert=True
                )
            except Exception:
                pass
        return user_dict
    return None

def get_user_by_identifier(identifier: str):
    if not identifier:
        return None
    identifier_clean = identifier.strip()
    if mongo_db is not None:
        try:
            rgx = {"$regex": f"^{re.escape(identifier_clean)}$", "$options": "i"}
            doc = mongo_db.users.find_one({"$or": [{"username": rgx}, {"email": rgx}]})
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception as e:
            logger.error(f"[MongoDB] Error getting user by identifier: {e}")

    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
        (identifier_clean, identifier_clean)
    )
    user = cursor.fetchone()
    conn.close()
    if user:
        user_dict = dict(user)
        if mongo_db is not None:
            try:
                mongo_db.users.update_one(
                    {"username": user_dict["username"]},
                    {"$set": user_dict},
                    upsert=True
                )
            except Exception:
                pass
        return user_dict
    return None

def create_user(username: str, hashed_password: str, email: str = "", full_name: str = ""):
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    username_clean = username.strip()
    email_clean = email.strip() if email else None
    full_name_clean = full_name.strip() if full_name else None

    # Keep SQLite in sync
    conn = get_db_connection()
    if conn is not None:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO users (username, email, hashed_password, full_name, created_at) VALUES (?, ?, ?, ?, ?)",
                (username_clean, email_clean, hashed_password, full_name_clean, created_at)
            )
            conn.commit()
        except Exception as e:
            logger.warning(f"[DB] SQLite user insert warning: {e}")
        finally:
            conn.close()

    if mongo_db is not None:
        try:
            # Check existing
            or_clauses = [{"username": {"$regex": f"^{re.escape(username_clean)}$", "$options": "i"}}]
            if email_clean:
                or_clauses.append({"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}})
            existing = mongo_db.users.find_one({"$or": or_clauses})
            if existing:
                return False

            doc = {
                "username": username_clean,
                "hashed_password": hashed_password,
                "full_name": full_name_clean or "",
                "created_at": created_at
            }
            if email_clean:
                doc["email"] = email_clean

            mongo_db.users.insert_one(doc)
            return True
        except Exception as e:
            logger.error(f"[MongoDB] Error creating user: {e}")
            return False

    return True

def update_user_password(identifier: str, hashed_password: str):
    if not identifier:
        return False
    identifier_clean = identifier.strip()
    updated = False

    if mongo_db is not None:
        try:
            rgx = {"$regex": f"^{re.escape(identifier_clean)}$", "$options": "i"}
            res = mongo_db.users.update_one(
                {"$or": [{"username": rgx}, {"email": rgx}]},
                {"$set": {"hashed_password": hashed_password}}
            )
            if res.matched_count > 0:
                updated = True
        except Exception as e:
            logger.error(f"[MongoDB] Error updating password: {e}")

    conn = get_db_connection()
    if conn is not None:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET hashed_password = ? WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
                (hashed_password, identifier_clean, identifier_clean)
            )
            conn.commit()
            if cursor.rowcount > 0:
                updated = True
                if mongo_db is not None:
                    cursor.execute(
                        "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
                        (identifier_clean, identifier_clean)
                    )
                    row = cursor.fetchone()
                    if row:
                        u_dict = dict(row)
                        doc = {
                            "username": u_dict["username"],
                            "hashed_password": hashed_password,
                            "full_name": u_dict.get("full_name") or "",
                            "created_at": u_dict.get("created_at") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
                        }
                        if u_dict.get("email"):
                            doc["email"] = u_dict["email"]
                        mongo_db.users.update_one(
                            {"username": {"$regex": f"^{re.escape(u_dict['username'])}$", "$options": "i"}},
                            {"$set": doc},
                            upsert=True
                        )
        except Exception as e:
            logger.error(f"[DB] Failed to update user password in SQLite: {e}")
        finally:
            conn.close()

    return updated

def update_user_profile(username: str, email: str = None, full_name: str = None):
    if not username:
        return False
    username_clean = username.strip()
    updated = False

    set_fields = {}
    if full_name is not None:
        set_fields["full_name"] = full_name.strip()
    if email is not None:
        set_fields["email"] = email.strip().lower()

    if not set_fields:
        return True

    if mongo_db is not None:
        try:
            rgx = {"$regex": f"^{re.escape(username_clean)}$", "$options": "i"}
            res = mongo_db.users.update_one(
                {"username": rgx},
                {"$set": set_fields}
            )
            if res.matched_count > 0:
                updated = True
        except Exception as e:
            logger.error(f"[MongoDB] Error updating user profile: {e}")

    conn = get_db_connection()
    if conn is not None:
        try:
            cursor = conn.cursor()
            cols = []
            vals = []
            if "full_name" in set_fields:
                cols.append("full_name = ?")
                vals.append(set_fields["full_name"])
            if "email" in set_fields:
                cols.append("email = ?")
                vals.append(set_fields["email"])
            vals.append(username_clean)
            sql = f"UPDATE users SET {', '.join(cols)} WHERE username = ? COLLATE NOCASE"
            cursor.execute(sql, tuple(vals))
            conn.commit()
            if cursor.rowcount > 0:
                updated = True
        except Exception as e:
            logger.error(f"[DB] Failed to update user profile in SQLite: {e}")
        finally:
            conn.close()

    return updated

# ── Password Reset Operations ────────────────────────────────────────────────

def create_password_reset(email: str, otp: str, token: str, expires_minutes: int = 15):
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    expires_at = (datetime.utcnow() + timedelta(minutes=expires_minutes)).strftime("%Y-%m-%d %H:%M:%S UTC")
    email_clean = email.strip()
    otp_clean = otp.strip()
    token_clean = token.strip()

    if mongo_db is not None:
        try:
            mongo_db.password_resets.update_many(
                {"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}, "used": 0},
                {"$set": {"used": 1}}
            )
            mongo_db.password_resets.insert_one({
                "email": email_clean,
                "otp": otp_clean,
                "token": token_clean,
                "expires_at": expires_at,
                "used": 0,
                "created_at": created_at
            })
            return True
        except Exception as e:
            logger.error(f"[MongoDB] Error creating password reset: {e}")

    conn = get_db_connection()
    if conn is None:
        return False
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE password_resets SET used = 1 WHERE email = ? COLLATE NOCASE AND used = 0", (email_clean,))
        cursor.execute(
            "INSERT INTO password_resets (email, otp, token, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)",
            (email_clean, otp_clean, token_clean, expires_at, created_at)
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"[DB] Error creating password reset: {e}")
        return False
    finally:
        conn.close()

def verify_password_reset_otp(email: str, otp: str):
    email_clean = email.strip()
    otp_clean = otp.strip()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    if mongo_db is not None:
        try:
            doc = mongo_db.password_resets.find_one(
                {
                    "email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"},
                    "otp": otp_clean,
                    "used": 0,
                    "expires_at": {"$gt": now_str}
                },
                sort=[("created_at", DESCENDING)]
            )
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception as e:
            logger.error(f"[MongoDB] Error verifying OTP: {e}")

    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT * FROM password_resets 
            WHERE email = ? COLLATE NOCASE 
              AND otp = ? 
              AND used = 0 
              AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (email_clean, otp_clean, now_str)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def verify_password_reset_token(token: str):
    token_clean = token.strip()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    if mongo_db is not None:
        try:
            doc = mongo_db.password_resets.find_one(
                {"token": token_clean, "used": 0, "expires_at": {"$gt": now_str}}
            )
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception as e:
            logger.error(f"[MongoDB] Error verifying reset token: {e}")

    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT * FROM password_resets 
            WHERE token = ? 
              AND used = 0 
              AND expires_at > ?
            LIMIT 1
            """,
            (token_clean, now_str)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def mark_password_reset_used(token_or_otp: str):
    if not token_or_otp:
        return False
    key = token_or_otp.strip()

    if mongo_db is not None:
        try:
            mongo_db.password_resets.update_many(
                {"$or": [{"token": key}, {"otp": key}]},
                {"$set": {"used": 1}}
            )
            return True
        except Exception as e:
            logger.error(f"[MongoDB] Error marking reset used: {e}")

    conn = get_db_connection()
    if conn is None:
        return False
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE password_resets SET used = 1 WHERE token = ? OR otp = ?",
            (key, key)
        )
        conn.commit()
        return True
    finally:
        conn.close()

# ── Medical Reports Operations ───────────────────────────────────────────────

def save_report(report_id: str, pdf_url: str, category: str, probability: float, patient_data: dict, prediction_data: dict, user_id: str = "guest"):
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    report_id_str = str(report_id)
    user_id_str = str(user_id) if user_id and not hasattr(user_id, 'dependency') else "guest"
    pdf_url_str = str(pdf_url)
    category_str = str(category) if category else "Unknown"

    try:
        probability_val = float(probability)
    except (ValueError, TypeError):
        probability_val = 0.0

    patient_dict = patient_data if isinstance(patient_data, dict) else {}
    prediction_dict = prediction_data if isinstance(prediction_data, dict) else {}

    try:
        age_val = float(patient_dict.get("age", 0.0))
    except (ValueError, TypeError):
        age_val = 0.0

    try:
        sex_val = int(patient_dict.get("sex", 0))
    except (ValueError, TypeError):
        sex_val = 0

    try:
        trestbps_val = float(patient_dict.get("trestbps", 0.0))
    except (ValueError, TypeError):
        trestbps_val = 0.0

    try:
        chol_val = float(patient_dict.get("chol", 0.0))
    except (ValueError, TypeError):
        chol_val = 0.0

    report_document = {
        "id": report_id_str,
        "user_id": user_id_str,
        "created_at": created_at,
        "pdf_url": pdf_url_str,
        "category": category_str,
        "probability": probability_val,
        "age": age_val,
        "sex": sex_val,
        "trestbps": trestbps_val,
        "chol": chol_val,
        "patient_data": patient_dict,
        "prediction_data": prediction_dict
    }

    if mongo_db is not None:
        try:
            mongo_db.reports.replace_one({"id": report_id_str}, report_document, upsert=True)
            return True
        except Exception as e:
            logger.error(f"[MongoDB] Error saving report {report_id}: {e}")

    conn = get_db_connection()
    if conn is None:
        return False
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT OR REPLACE INTO reports (
                id, user_id, created_at, pdf_url, category, probability, age, sex, trestbps, chol, patient_data, prediction_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id_str,
                user_id_str,
                created_at,
                pdf_url_str,
                category_str,
                probability_val,
                age_val,
                sex_val,
                trestbps_val,
                chol_val,
                json.dumps(patient_dict),
                json.dumps(prediction_dict)
            )
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"[DB] Error saving report {report_id}: {e}")
        return False
    finally:
        conn.close()

def get_all_reports(limit: int = 50, user_id: str = None):
    if mongo_db is not None:
        try:
            query = {}
            if user_id and user_id != "admin" and user_id != "guest":
                query["user_id"] = user_id
            cursor = mongo_db.reports.find(query).sort("created_at", DESCENDING).limit(limit)
            reports = []
            for r in cursor:
                r["_id"] = str(r["_id"])
                reports.append(r)
            return reports
        except Exception as e:
            logger.error(f"[MongoDB] Error fetching reports: {e}")

    conn = get_db_connection()
    if conn is None:
        return []
    cursor = conn.cursor()
    try:
        if user_id and user_id != "admin" and user_id != "guest":
            cursor.execute("SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", (user_id, limit))
        else:
            cursor.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        reports = []
        for r in rows:
            reports.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "created_at": r["created_at"],
                "pdf_url": r["pdf_url"],
                "category": r["category"],
                "probability": r["probability"],
                "age": r["age"],
                "sex": r["sex"],
                "trestbps": r["trestbps"],
                "chol": r["chol"],
                "patient_data": json.loads(r["patient_data"]) if r["patient_data"] else {},
                "prediction_data": json.loads(r["prediction_data"]) if r["prediction_data"] else {}
            })
        return reports
    except Exception as e:
        logger.error(f"[DB] Error fetching reports: {e}")
        return []
    finally:
        conn.close()
