"""
NetExplain Application Unit Tests
Tests FastAPI route logic, deterministic simulations, passlib password security,
JWT token creation & verification, and strict data sequestration.
"""

import uuid
from unittest.mock import MagicMock
import pytest

from app import (
    root_info,
    get_health,
    get_agent_status,
    run_simulation,
    cancel_diagnosis_session,
    SimulationRequest,
    RegisterRequest,
    LoginRequest,
    register,
    login,
    get_diagnosis_history,
)
import storage


def test_root_endpoint():
    data = root_info()
    assert data["service"] == "NetExplain API"
    assert data["tagline"] == "Measure. Explain. Resolve."
    assert data["phase"] == "phase-2"
    assert "0.2.0" in data["api_version"]


def test_health_endpoint():
    res = get_health()
    assert res.status == "ok"
    assert res.phase == "phase-2"
    assert "0.2.0" in res.api_version
    assert "operational" in res.message


def test_agent_status_endpoint():
    status_resp = get_agent_status()
    assert status_resp.api_available is True
    assert status_resp.measurement_engine == "online"
    assert status_resp.phase == "phase-2"
    assert len(status_resp.capabilities) >= 6
    for cap in status_resp.capabilities:
        assert cap.enabled is True


def test_passlib_and_jwt_auth_workflow():
    uname = f"test_sec_{uuid.uuid4().hex[:6]}"
    raw_pwd = "SuperSecretPassword123!"

    # 1. Create user with passlib
    user = storage.create_user(uname, raw_pwd, "Security Tester")
    assert user["username"] == uname
    assert user["display_name"] == "Security Tester"
    assert "user_id" in user

    # 2. Verify authentication with correct password
    auth_user = storage.authenticate_user(uname, raw_pwd)
    assert auth_user is not None
    assert auth_user["user_id"] == user["user_id"]

    # 3. Verify authentication fails with incorrect password
    failed_user = storage.authenticate_user(uname, "WrongPassword999!")
    assert failed_user is None

    # 4. JWT generation and decoding
    jwt_token = storage.create_jwt_token(user["user_id"], user["username"])
    assert isinstance(jwt_token, str) and len(jwt_token) > 20

    decoded = storage.decode_jwt_token(jwt_token)
    assert decoded is not None
    assert decoded["user_id"] == user["user_id"]
    assert decoded["username"] == uname

    # 5. Invalid / tampered token handling
    tampered_token = jwt_token[:-4] + "fake"
    assert storage.decode_jwt_token(tampered_token) is None


def test_data_sequestration_multi_tenant():
    """
    Verifies that User A can NEVER view or access User B's diagnostic history.
    """
    user_a_id = f"tenant_a_{uuid.uuid4().hex[:8]}"
    user_b_id = f"tenant_b_{uuid.uuid4().hex[:8]}"

    # Save session for User A
    session_a = {
        "session_id": f"sess-a-{uuid.uuid4().hex[:8]}",
        "created_at": "2026-10-30T12:00:00Z",
        "completed_at": "2026-10-30T12:01:00Z",
        "status": "completed",
        "client_ip": "192.168.1.50",
        "tests": {},
        "diagnosis": {"primary_diagnosis": "User A Baseline", "summary": "Tenant A Test"},
        "is_simulated": False,
        "user_id": user_a_id,
    }
    storage.save_session(session_a)

    # Save session for User B
    session_b = {
        "session_id": f"sess-b-{uuid.uuid4().hex[:8]}",
        "created_at": "2026-10-30T12:05:00Z",
        "completed_at": "2026-10-30T12:06:00Z",
        "status": "completed",
        "client_ip": "192.168.1.60",
        "tests": {},
        "diagnosis": {"primary_diagnosis": "User B Baseline", "summary": "Tenant B Test"},
        "is_simulated": False,
        "user_id": user_b_id,
    }
    storage.save_session(session_b)

    # Query sessions for User A - must only see session_a
    history_a = storage.list_sessions(limit=50, user_id=user_a_id)
    session_ids_a = [s["session_id"] for s in history_a]
    assert session_a["session_id"] in session_ids_a
    assert session_b["session_id"] not in session_ids_a

    # Query sessions for User B - must only see session_b
    history_b = storage.list_sessions(limit=50, user_id=user_b_id)
    session_ids_b = [s["session_id"] for s in history_b]
    assert session_b["session_id"] in session_ids_b
    assert session_a["session_id"] not in session_ids_b

    # Test clear_history only clears that tenant's records
    storage.clear_history(user_id=user_a_id)
    history_a_after = storage.list_sessions(limit=50, user_id=user_a_id)
    assert len(history_a_after) == 0

    # User B's records must remain intact
    history_b_after = storage.list_sessions(limit=50, user_id=user_b_id)
    assert session_b["session_id"] in [s["session_id"] for s in history_b_after]


def test_controlled_simulation_scenarios():
    scenarios = ["gateway_down", "dns_failure", "packet_loss", "bufferbloat"]
    mock_req = MagicMock()
    mock_req.client.host = "127.0.0.1"
    mock_req.cookies = {}
    mock_req.headers = {}

    for sc in scenarios:
        req = SimulationRequest(scenario=sc)
        data = run_simulation(req, mock_req)
        assert data["is_simulated"] is True
        assert data["status"] == "completed"
        assert "[SIMULATED]" in data["diagnosis"]["primary_diagnosis"]
        assert data["client_ip"] == "SIMULATION-SANDBOX"
        assert len(data["tests"]) == 6


def test_session_cancellation():
    session_id = f"test-cancel-{uuid.uuid4().hex[:8]}"
    session = {
        "session_id": session_id,
        "created_at": "2026-10-30T12:00:00Z",
        "status": "running",
        "client_ip": "127.0.0.1",
        "tests": {},
        "diagnosis": None,
        "is_simulated": False,
        "user_id": None,
    }
    storage.save_session(session)

    res = cancel_diagnosis_session(session_id)
    assert res["status"] == "cancelled"
    assert res["session_id"] == session_id

    updated = storage.get_session(session_id)
    assert updated["status"] == "cancelled"
    assert updated["completed_at"] is not None
