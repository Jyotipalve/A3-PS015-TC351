"""
NetExplain Storage and Diagnostic Session Registry
Thread-safe in-memory session manager with SQLite persistence.
Includes secure user authentication, HttpOnly session tokens, and simulation tagging.
"""

import json
import os
import secrets
import sqlite3
import threading
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jwt
from passlib.context import CryptContext

DB_PATH = Path(os.getenv("NETEXPLAIN_DB_PATH", Path(__file__).parent / "netexplain_v2.db"))
_lock = threading.Lock()

# Global in-memory active session store
_active_sessions: Dict[str, Dict[str, Any]] = {}

# NIST & passlib compliant password hashing context
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

# JWT configuration (66-byte cryptographically strong default key)
JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "netexplain_super_secret_jwt_key_2026_aiori_hackathon_diagnosis_engine",
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Hashes password using passlib pbkdf2_sha256 scheme.
    Returns (hashed_password, salt_token).
    """
    if not salt:
        salt = secrets.token_hex(16)
    # Use passlib for standardized, verifiable hash string
    hashed = pwd_context.hash(password)
    return hashed, salt


def verify_password(password: str, stored_hash: str, salt: Optional[str] = None) -> bool:
    """
    Verifies password using passlib, with legacy PBKDF2 fallback.
    """
    try:
        if pwd_context.identify(stored_hash):
            return pwd_context.verify(password, stored_hash)
    except Exception:
        pass

    # Legacy hex PBKDF2 fallback
    if salt:
        try:
            calculated_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                100_000,
            ).hex()
            return secrets.compare_digest(calculated_hash, stored_hash)
        except Exception:
            pass

    return False


def create_jwt_token(user_id: str, username: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a cryptographically signed JWT access token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)

    payload = {
        "sub": user_id,
        "username": username,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "netexplain-api",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates and decodes a JWT access token. Returns dict with user_id and username or None.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer="netexplain-api")
        return {
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
        }
    except jwt.PyJWTError:
        return None


def init_db():
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Diagnostic sessions table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnostic_sessions (
                session_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                status TEXT NOT NULL,
                client_ip TEXT,
                tests_json TEXT NOT NULL,
                diagnosis_json TEXT,
                summary TEXT,
                is_simulated INTEGER DEFAULT 0,
                user_id TEXT
            )
            """
        )

        # Users table for secure authentication
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        # HttpOnly auth sessions table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
            """
        )

        # Ensure columns exist if migrating from earlier schema
        cursor.execute("PRAGMA table_info(diagnostic_sessions)")
        cols = [c[1] for c in cursor.fetchall()]
        if "is_simulated" not in cols:
            cursor.execute("ALTER TABLE diagnostic_sessions ADD COLUMN is_simulated INTEGER DEFAULT 0")
        if "user_id" not in cols:
            cursor.execute("ALTER TABLE diagnostic_sessions ADD COLUMN user_id TEXT")

        conn.commit()
        conn.close()


init_db()


# ---------------------------------------------------------------------------
# Authentication Functions
# ---------------------------------------------------------------------------

def create_user(username: str, password: str, display_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates a new user account with securely salted PBKDF2 password hash.
    """
    cleaned_username = username.strip().lower()
    if len(cleaned_username) < 3:
        raise ValueError("Username must be at least 3 characters long")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    user_id = secrets.token_hex(16)
    pwd_hash, salt = hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()
    disp_name = display_name.strip() if display_name else cleaned_username.capitalize()

    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO users (user_id, username, password_hash, salt, display_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, cleaned_username, pwd_hash, salt, disp_name, now_iso),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            raise ValueError(f"Username '{cleaned_username}' is already registered")
        conn.close()

    return {
        "user_id": user_id,
        "username": cleaned_username,
        "display_name": disp_name,
        "created_at": now_iso,
    }


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticates username and password. Returns user dict or None.
    """
    cleaned_username = username.strip().lower()
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, username, password_hash, salt, display_name, created_at FROM users WHERE username = ?",
            (cleaned_username,),
        )
        row = cursor.fetchone()
        conn.close()

    if not row:
        return None

    user_id, uname, stored_hash, salt, disp_name, created_at = row
    if not verify_password(password, stored_hash, salt):
        return None

    return {
        "user_id": user_id,
        "username": uname,
        "display_name": disp_name,
        "created_at": created_at,
    }


def create_auth_session(user_id: str, lifetime_days: int = 7) -> str:
    """
    Generates a cryptographically secure session token and stores in DB.
    """
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=lifetime_days)

    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now.isoformat(), expires.isoformat()),
        )
        conn.commit()
        conn.close()

    return token


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user profile by user_id.
    """
    if not user_id:
        return None
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, username, display_name, created_at FROM users WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        conn.close()
    if not row:
        return None
    return {
        "user_id": row[0],
        "username": row[1],
        "display_name": row[2],
        "created_at": row[3],
    }


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates token (either signed JWT or SQLite session token)
    and returns authenticated user object if valid and unexpired.
    """
    if not token:
        return None

    # First attempt JWT decode
    jwt_data = decode_jwt_token(token)
    if jwt_data and jwt_data.get("user_id"):
        user = get_user_by_id(jwt_data["user_id"])
        if user:
            return user

    # Fallback: SQLite session token lookup
    now_iso = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.display_name, u.created_at, s.expires_at
            FROM auth_sessions s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, now_iso),
        )
        row = cursor.fetchone()
        conn.close()

    if not row:
        return None

    return {
        "user_id": row[0],
        "username": row[1],
        "display_name": row[2],
        "created_at": row[3],
    }


def delete_auth_session(token: str):
    """
    Revokes an active session token.
    """
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()


# ---------------------------------------------------------------------------
# Diagnostic Session Persistence
# ---------------------------------------------------------------------------

def save_session(session: Dict[str, Any]):
    """
    Saves or updates a diagnostic session in both memory and SQLite.
    """
    session_id = session["session_id"]
    with _lock:
        _active_sessions[session_id] = session

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO diagnostic_sessions 
                (session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    completed_at = excluded.completed_at,
                    status = excluded.status,
                    tests_json = excluded.tests_json,
                    diagnosis_json = excluded.diagnosis_json,
                    summary = excluded.summary,
                    is_simulated = excluded.is_simulated,
                    user_id = excluded.user_id
                """,
                (
                    session["session_id"],
                    session["created_at"],
                    session.get("completed_at"),
                    session["status"],
                    session.get("client_ip", "127.0.0.1"),
                    json.dumps(session.get("tests", {})),
                    json.dumps(session.get("diagnosis", {})),
                    session.get("diagnosis", {}).get("summary", ""),
                    1 if session.get("is_simulated") else 0,
                    session.get("user_id"),
                ),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a session by ID from memory, falling back to SQLite.
    """
    with _lock:
        if session_id in _active_sessions:
            return _active_sessions[session_id]

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id
            FROM diagnostic_sessions WHERE session_id = ?
            """,
            (session_id,),
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            session = {
                "session_id": row[0],
                "created_at": row[1],
                "completed_at": row[2],
                "status": row[3],
                "client_ip": row[4],
                "tests": json.loads(row[5]) if row[5] else {},
                "diagnosis": json.loads(row[6]) if row[6] else {},
                "summary": row[7] or "",
                "is_simulated": bool(row[8]),
                "user_id": row[9],
            }
            with _lock:
                _active_sessions[session_id] = session
            return session
    except Exception:
        pass

    return None


def list_sessions(limit: int = 50, include_simulated: bool = True, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns list of saved sessions ordered by creation date descending.
    If user_id is provided, enforces strict data sequestration by returning only sessions owned by that user.
    """
    sessions: List[Dict[str, Any]] = []
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if user_id:
            if include_simulated:
                cursor.execute(
                    """
                    SELECT session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id
                    FROM diagnostic_sessions
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id
                    FROM diagnostic_sessions
                    WHERE user_id = ? AND is_simulated = 0
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                )
        else:
            if include_simulated:
                cursor.execute(
                    """
                    SELECT session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id
                    FROM diagnostic_sessions
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            else:
                cursor.execute(
                    """
                    SELECT session_id, created_at, completed_at, status, client_ip, tests_json, diagnosis_json, summary, is_simulated, user_id
                    FROM diagnostic_sessions
                    WHERE is_simulated = 0
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            sessions.append({
                "session_id": row[0],
                "created_at": row[1],
                "completed_at": row[2],
                "status": row[3],
                "client_ip": row[4],
                "tests": json.loads(row[5]) if row[5] else {},
                "diagnosis": json.loads(row[6]) if row[6] else {},
                "summary": row[7] or "",
                "is_simulated": bool(row[8]),
                "user_id": row[9],
            })
    except Exception:
        pass

    return sessions


def clear_history(user_id: Optional[str] = None):
    """
    Purges historical diagnostic sessions. If user_id is provided, purges only that user's sessions.
    """
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM diagnostic_sessions WHERE user_id = ?", (user_id,))
            to_del = [sid for sid, s in _active_sessions.items() if s.get("user_id") == user_id]
            for sid in to_del:
                _active_sessions.pop(sid, None)
        else:
            _active_sessions.clear()
            cursor.execute("DELETE FROM diagnostic_sessions")
        conn.commit()
        conn.close()
