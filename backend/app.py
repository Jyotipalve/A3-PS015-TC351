import os
import secrets
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from diagnostic_engine import (
    run_dns_test,
    run_external_connectivity_test,
    run_gateway_test,
    run_mild_load_test,
    run_packet_loss_test,
)
from rule_engine import evaluate_diagnostic_evidence
import storage

load_dotenv()

API_VERSION = os.getenv("API_VERSION", "0.2.0")
cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173",
)
origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app = FastAPI(
    title="NetExplain API",
    description="Explainable home and last-mile connectivity diagnosis platform - AIORI Hackathon 3 (PS-015)",
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Flexible CORS with allow_origin_regex for any local development port
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = Field(..., description="API operational status", json_schema_extra={"example": "ok"})
    api_version: str = Field(..., description="Semantic version of NetExplain API", json_schema_extra={"example": "0.2.0"})
    phase: str = Field("phase-2", description="Current development phase identifier", json_schema_extra={"example": "phase-2"})
    message: str = Field(..., description="Human-readable status message", json_schema_extra={"example": "NetExplain API is operational."})


class AgentCapability(BaseModel):
    name: str = Field(..., description="Capability name")
    enabled: bool = Field(..., description="Whether capability is active")
    description: str = Field(..., description="Description of engine capability")


class AgentStatusResponse(BaseModel):
    api_available: bool = Field(True, description="Indicates if the API is reachable")
    measurement_engine: str = Field("online", description="Status of diagnostic measurement engine ('online')")
    phase: str = Field("phase-2", description="Current project phase")
    message: str = Field(..., description="Diagnostic engine status detail")
    capabilities: List[AgentCapability] = Field(default_factory=list, description="Supported engine capabilities")


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    password: str = Field(..., min_length=6, description="Account password")
    display_name: Optional[str] = Field(None, description="Optional friendly name")


class LoginRequest(BaseModel):
    username: str = Field(..., description="Registered username")
    password: str = Field(..., description="Account password")


class UserResponse(BaseModel):
    user_id: str
    username: str
    display_name: Optional[str] = None
    created_at: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"


class RunDiagnosisRequest(BaseModel):
    gateway_override: Optional[str] = Field(None, description="Optional manual gateway IP override")
    dns_hostname: str = Field("google.com", description="Target hostname for DNS resolution test")
    icmp_target: str = Field("1.1.1.1", description="Target public IP for ICMP latency and loss probe")
    http_target: str = Field("https://connectivitycheck.gstatic.com/generate_204", description="HTTP/HTTPS reachability probe URL")


class SimulationRequest(BaseModel):
    scenario: str = Field(..., description="Scenario identifier: 'gateway_down', 'dns_failure', 'packet_loss', or 'bufferbloat'")


class SingleTestResult(BaseModel):
    test_id: str
    name: str
    status: str  # pending, running, completed, pass, fail, warning, inconclusive, skipped
    target: str
    method: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_ms: Optional[float] = None
    measured_values: Dict[str, Any] = Field(default_factory=dict)
    error_details: Optional[str] = None
    interpretation: Optional[str] = None


class DiagnosticSessionResponse(BaseModel):
    session_id: str
    created_at: str
    completed_at: Optional[str] = None
    status: str  # pending, running, completed, failed, cancelled
    client_ip: Optional[str] = "127.0.0.1"
    tests: Dict[str, SingleTestResult] = Field(default_factory=dict)
    diagnosis: Optional[Dict[str, Any]] = None
    progress_pct: int = 0
    is_simulated: bool = False
    user_id: Optional[str] = None


# Global cancellation flag dictionary
_cancellation_flags: Dict[str, bool] = {}


# ---------------------------------------------------------------------------
# Authentication Dependencies
# ---------------------------------------------------------------------------

COOKIE_NAME = "netexplain_session"

def get_optional_current_user(request: Request) -> Optional[Dict[str, Any]]:
    # 1. Prefer Authorization Bearer header (JWT)
    auth_hdr = request.headers.get("Authorization")
    if auth_hdr and auth_hdr.startswith("Bearer "):
        token = auth_hdr.split(" ")[1]
        user = storage.get_user_from_token(token)
        if user:
            return user
    # 2. Fallback to HttpOnly session cookie
    token = request.cookies.get(COOKIE_NAME)
    if token:
        user = storage.get_user_from_token(token)
        if user:
            return user
    return None


def get_current_user(request: Request) -> Dict[str, Any]:
    user = get_optional_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )
    return user


# ---------------------------------------------------------------------------
# Background Diagnostic Execution Worker
# ---------------------------------------------------------------------------

def _execute_session_pipeline(session_id: str, request_params: RunDiagnosisRequest, client_ip: str):
    """
    Executes each diagnostic test sequentially, updating live session state
    and persisting progress after each test completes.
    """
    session = storage.get_session(session_id)
    if not session:
        return

    session["status"] = "running"
    storage.save_session(session)

    tests_plan = [
        ("gateway", "Default Gateway Reachability"),
        ("dns", "DNS Resolution Latency"),
        ("external_icmp", "External ICMP Echo"),
        ("external_http", "External HTTP Web Verification"),
        ("packet_loss", "End-to-End Packet Loss & Latency"),
        ("mild_load", "Mild-Load Bufferbloat Comparison"),
    ]

    for idx, (test_id, test_name) in enumerate(tests_plan):
        # Check for user cancellation
        if _cancellation_flags.get(session_id, False):
            session["status"] = "cancelled"
            session["completed_at"] = datetime.now(timezone.utc).isoformat()
            storage.save_session(session)
            return

        # Mark current test as running
        session["tests"][test_id]["status"] = "running"
        session["tests"][test_id]["start_time"] = datetime.now(timezone.utc).isoformat()
        storage.save_session(session)

        try:
            if test_id == "gateway":
                result = run_gateway_test(override_ip=request_params.gateway_override, count=4)
            elif test_id == "dns":
                result = run_dns_test(hostname=request_params.dns_hostname)
            elif test_id == "external_icmp":
                icmp_res, http_res = run_external_connectivity_test(
                    icmp_target=request_params.icmp_target,
                    http_target=request_params.http_target,
                )
                result = icmp_res
                session["_cached_http_res"] = http_res
            elif test_id == "external_http":
                result = session.pop("_cached_http_res", None)
                if not result:
                    _, result = run_external_connectivity_test(
                        icmp_target=request_params.icmp_target,
                        http_target=request_params.http_target,
                    )
            elif test_id == "packet_loss":
                result = run_packet_loss_test(target=request_params.icmp_target, count=5)
            elif test_id == "mild_load":
                result = run_mild_load_test(ping_target=request_params.icmp_target)
            else:
                continue

            session["tests"][test_id] = result
        except Exception as exc:
            session["tests"][test_id] = {
                "test_id": test_id,
                "name": test_name,
                "status": "fail",
                "target": "unknown",
                "method": "exception",
                "start_time": session["tests"][test_id].get("start_time"),
                "end_time": datetime.now(timezone.utc).isoformat(),
                "duration_ms": 0.0,
                "measured_values": {},
                "error_details": str(exc),
                "interpretation": f"Internal test execution failed: {exc}",
            }

        progress_pct = int(((idx + 1) / len(tests_plan)) * 100)
        session["progress_pct"] = progress_pct
        storage.save_session(session)

    # All tests finished -> Synthesize deterministic diagnosis
    diagnosis_output = evaluate_diagnostic_evidence(session["tests"])
    session["diagnosis"] = diagnosis_output
    session["status"] = "completed"
    session["completed_at"] = datetime.now(timezone.utc).isoformat()
    session["progress_pct"] = 100
    storage.save_session(session)


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
def root_info():
    return {
        "service": "NetExplain API",
        "tagline": "Measure. Explain. Resolve.",
        "phase": "phase-2",
        "api_version": API_VERSION,
        "docs": "/docs",
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Diagnostics"])
def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        api_version=API_VERSION,
        phase="phase-2",
        message="NetExplain API is operational.",
    )


@app.get("/api/agent/status", response_model=AgentStatusResponse, tags=["Diagnostics"])
def get_agent_status() -> AgentStatusResponse:
    capabilities = [
        AgentCapability(
            name="Default Gateway Reachability",
            enabled=True,
            description="Automatic gateway detection via OS routing tables and ICMP RTT sampling.",
        ),
        AgentCapability(
            name="DNS Resolution Profiler",
            enabled=True,
            description="System socket resolver resolution timing and multi-address validation.",
        ),
        AgentCapability(
            name="External Connectivity Verification",
            enabled=True,
            description="Dual ICMP and HTTP/HTTPS web verification with captive portal detection.",
        ),
        AgentCapability(
            name="Packet Loss & Latency Distribution",
            enabled=True,
            description="Bounded multi-packet loss rate and min/avg/max RTT distribution metrics.",
        ),
        AgentCapability(
            name="Mild-Load Bufferbloat Comparison",
            enabled=True,
            description="Idle vs non-saturating concurrent HTTP workload latency delta comparison.",
        ),
        AgentCapability(
            name="Deterministic Rule & Evidence Engine",
            enabled=True,
            description="Transparent rule-based correlation, hypothesis testing, and confidence scoring.",
        ),
        AgentCapability(
            name="Secure User Authentication",
            enabled=True,
            description="NIST PBKDF2 password hashing with HttpOnly session cookies.",
        ),
        AgentCapability(
            name="Safe Innovation Fault Lab",
            enabled=True,
            description="Controlled simulation sandbox for edge-case failure evaluation.",
        ),
    ]

    return AgentStatusResponse(
        api_available=True,
        measurement_engine="online",
        phase="phase-2",
        message="NetExplain measurement and evidence engine is fully operational.",
        capabilities=capabilities,
    )


# ---------------------------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserResponse, tags=["Authentication"])
def register(req: RegisterRequest, response: Response):
    try:
        user = storage.create_user(req.username, req.password, req.display_name)
        cookie_token = storage.create_auth_session(user["user_id"])
        jwt_token = storage.create_jwt_token(user["user_id"], user["username"])
        response.set_cookie(
            key=COOKIE_NAME,
            value=cookie_token,
            httponly=True,
            samesite="lax",
            secure=False,  # Allow http in local development
            max_age=7 * 24 * 3600,
            path="/",
        )
        return {
            **user,
            "access_token": jwt_token,
            "token_type": "bearer",
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@app.post("/api/auth/login", response_model=UserResponse, tags=["Authentication"])
def login(req: LoginRequest, response: Response):
    user = storage.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    cookie_token = storage.create_auth_session(user["user_id"])
    jwt_token = storage.create_jwt_token(user["user_id"], user["username"])
    response.set_cookie(
        key=COOKIE_NAME,
        value=cookie_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
        path="/",
    )
    return {
        **user,
        "access_token": jwt_token,
        "token_type": "bearer",
    }


@app.post("/api/auth/logout", tags=["Authentication"])
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        storage.delete_auth_session(token)
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Diagnostic Session Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/run-full-diagnosis", response_model=DiagnosticSessionResponse, tags=["Diagnostics"])
def run_full_diagnosis(
    request: RunDiagnosisRequest,
    background_tasks: BackgroundTasks,
    req: Request,
):
    """
    Initializes a new diagnostic session and begins asynchronous background measurement.
    Returns session object with pending test items immediately.
    Clients poll /api/diagnosis/session/{session_id} for live progress.
    """
    session_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    client_ip = req.client.host if req.client else "127.0.0.1"

    current_user = get_optional_current_user(req)
    user_id = current_user["user_id"] if current_user else None

    initial_tests: Dict[str, Any] = {
        "gateway": {
            "test_id": "gateway",
            "name": "Default Gateway Reachability",
            "status": "pending",
            "target": request.gateway_override or "Auto-detect",
            "method": "ICMP Echo",
            "measured_values": {},
            "interpretation": "Waiting to execute gateway reachability probe...",
        },
        "dns": {
            "test_id": "dns",
            "name": "DNS Resolution Latency",
            "status": "pending",
            "target": request.dns_hostname,
            "method": "Socket getaddrinfo",
            "measured_values": {},
            "interpretation": "Waiting to test DNS resolution latency...",
        },
        "external_icmp": {
            "test_id": "external_icmp",
            "name": "External ICMP Echo",
            "status": "pending",
            "target": request.icmp_target,
            "method": "ICMP Echo",
            "measured_values": {},
            "interpretation": "Waiting to ping external public address...",
        },
        "external_http": {
            "test_id": "external_http",
            "name": "External HTTP Web Verification",
            "status": "pending",
            "target": request.http_target,
            "method": "HTTP GET via HTTPX",
            "measured_values": {},
            "interpretation": "Waiting to verify external HTTP connectivity...",
        },
        "packet_loss": {
            "test_id": "packet_loss",
            "name": "End-to-End Packet Loss & Latency",
            "status": "pending",
            "target": request.icmp_target,
            "method": "Bounded ICMP probe burst",
            "measured_values": {},
            "interpretation": "Waiting to measure packet loss and jitter...",
        },
        "mild_load": {
            "test_id": "mild_load",
            "name": "Mild-Load Bufferbloat Comparison",
            "status": "pending",
            "target": request.icmp_target,
            "method": "Idle vs Mild Workload Delta",
            "measured_values": {},
            "interpretation": "Waiting to measure bufferbloat under mild load...",
        },
    }

    session = {
        "session_id": session_id,
        "created_at": now_iso,
        "completed_at": None,
        "status": "pending",
        "client_ip": client_ip,
        "tests": initial_tests,
        "diagnosis": None,
        "progress_pct": 0,
        "is_simulated": False,
        "user_id": user_id,
    }

    _cancellation_flags[session_id] = False
    storage.save_session(session)

    # Spawn background runner thread
    background_tasks.add_task(_execute_session_pipeline, session_id, request, client_ip)

    return session


@app.get("/api/diagnosis/session/{session_id}", response_model=DiagnosticSessionResponse, tags=["Diagnostics"])
def get_diagnosis_session(session_id: str, req: Request):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic session '{session_id}' not found",
        )
    # Enforce data sequestration if session is owned by a user
    session_user_id = session.get("user_id")
    if session_user_id:
        current_user = get_optional_current_user(req)
        if not current_user or current_user["user_id"] != session_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view this diagnostic session.",
            )
    return session


@app.post("/api/diagnosis/session/{session_id}/cancel", tags=["Diagnostics"])
def cancel_diagnosis_session(session_id: str):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic session '{session_id}' not found",
        )

    _cancellation_flags[session_id] = True
    session["status"] = "cancelled"
    session["completed_at"] = datetime.now(timezone.utc).isoformat()
    storage.save_session(session)
    return {"status": "cancelled", "session_id": session_id}


@app.get("/api/diagnosis/history", tags=["Diagnostics"])
def get_diagnosis_history(
    limit: int = 50,
    include_simulated: bool = True,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns diagnostic session history strictly sequestered to the authenticated user.
    """
    return storage.list_sessions(limit=limit, include_simulated=include_simulated, user_id=user["user_id"])


@app.delete("/api/diagnosis/history", tags=["Diagnostics"])
def clear_diagnosis_history(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Protected endpoint: clears diagnostic session history for the current user.
    """
    storage.clear_history(user_id=user["user_id"])
    return {"status": "history_cleared", "operator": user["username"]}


# ---------------------------------------------------------------------------
# Safe Innovation Sandbox (Controlled Fault Simulation)
# ---------------------------------------------------------------------------

@app.post("/api/simulation/run", response_model=DiagnosticSessionResponse, tags=["Simulation"])
def run_simulation(req: SimulationRequest, request: Request):
    """
    Executes a controlled fault simulation scenario through the deterministic rule engine.
    Clearly marked as SIMULATED; never confused with live measurements.
    """
    scenario = req.scenario.lower().strip()
    session_id = f"sim-{secrets.token_hex(8)}"
    now_iso = datetime.now(timezone.utc).isoformat()

    current_user = get_optional_current_user(request)
    user_id = current_user["user_id"] if current_user else None

    if scenario == "gateway_down":
        tests = {
            "gateway": {
                "test_id": "gateway",
                "name": "Default Gateway Reachability",
                "status": "fail",
                "target": "192.168.1.1 (SIMULATED)",
                "method": "Simulated ICMP Echo",
                "duration_ms": 1000.0,
                "measured_values": {"gateway_ip": "192.168.1.1", "packet_loss_pct": 100.0, "rtt_avg_ms": None},
                "error_details": "SIMULATION: Destination host unreachable (100% loss)",
                "interpretation": "[SIMULATED] Gateway connection severed. Local link unavailable.",
            },
            "dns": {
                "test_id": "dns",
                "name": "DNS Resolution Latency",
                "status": "fail",
                "target": "google.com",
                "method": "Simulated Resolver",
                "duration_ms": 1000.0,
                "measured_values": {"hostname": "google.com"},
                "error_details": "SIMULATION: Resolver unreachable",
                "interpretation": "[SIMULATED] DNS lookup failed due to severed local link.",
            },
            "external_icmp": {
                "test_id": "external_icmp",
                "name": "External ICMP Echo",
                "status": "fail",
                "target": "1.1.1.1",
                "method": "Simulated Ping",
                "duration_ms": 1000.0,
                "measured_values": {"packet_loss_pct": 100.0},
                "error_details": "SIMULATION: No route to host",
                "interpretation": "[SIMULATED] No packets leaving subnet.",
            },
            "external_http": {
                "test_id": "external_http",
                "name": "External HTTP Verification",
                "status": "fail",
                "target": "https://connectivitycheck.gstatic.com",
                "method": "Simulated HTTP",
                "duration_ms": 1000.0,
                "measured_values": {},
                "error_details": "SIMULATION: Network down",
                "interpretation": "[SIMULATED] HTTP request aborted.",
            },
            "packet_loss": {
                "test_id": "packet_loss",
                "name": "End-to-End Packet Loss & Latency",
                "status": "fail",
                "target": "1.1.1.1",
                "method": "Simulated Burst",
                "duration_ms": 1000.0,
                "measured_values": {"packet_loss_pct": 100.0},
                "error_details": "SIMULATION: 100% loss",
                "interpretation": "[SIMULATED] Total packet drop.",
            },
            "mild_load": {
                "test_id": "mild_load",
                "name": "Mild-Load Bufferbloat Comparison",
                "status": "inconclusive",
                "target": "1.1.1.1",
                "method": "Simulated Workload",
                "duration_ms": 0.0,
                "measured_values": {},
                "error_details": "SIMULATION: Cannot establish baseline",
                "interpretation": "[SIMULATED] Test skipped due to local outage.",
            },
        }

    elif scenario == "dns_failure":
        tests = {
            "gateway": {
                "test_id": "gateway",
                "name": "Default Gateway Reachability",
                "status": "pass",
                "target": "192.168.1.1 (SIMULATED)",
                "method": "Simulated ICMP Echo",
                "duration_ms": 12.0,
                "measured_values": {"gateway_ip": "192.168.1.1", "packet_loss_pct": 0.0, "rtt_avg_ms": 2.4},
                "interpretation": "[SIMULATED] Gateway LAN hop is healthy.",
            },
            "dns": {
                "test_id": "dns",
                "name": "DNS Resolution Latency",
                "status": "fail",
                "target": "google.com",
                "method": "Simulated Resolver",
                "duration_ms": 2500.0,
                "measured_values": {"hostname": "google.com"},
                "error_details": "SIMULATION: Socket gaierror (Server failure REFUSED)",
                "interpretation": "[SIMULATED] DNS resolver failed to resolve hostnames.",
            },
            "external_icmp": {
                "test_id": "external_icmp",
                "name": "External ICMP Echo",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Ping",
                "duration_ms": 30.0,
                "measured_values": {"target": "1.1.1.1", "packet_loss_pct": 0.0, "rtt_avg_ms": 18.2},
                "interpretation": "[SIMULATED] Direct IP routing to 1.1.1.1 works with 0% loss.",
            },
            "external_http": {
                "test_id": "external_http",
                "name": "External HTTP Verification",
                "status": "pass",
                "target": "http://1.1.1.1",
                "method": "Simulated Direct IP HTTP",
                "duration_ms": 45.0,
                "measured_values": {"status_code": 200, "http_rtt_ms": 42.0},
                "interpretation": "[SIMULATED] Direct IP HTTP succeeded.",
            },
            "packet_loss": {
                "test_id": "packet_loss",
                "name": "End-to-End Packet Loss & Latency",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Burst",
                "duration_ms": 50.0,
                "measured_values": {"packet_loss_pct": 0.0, "rtt_avg_ms": 18.0},
                "interpretation": "[SIMULATED] Link layer is clean (0% loss).",
            },
            "mild_load": {
                "test_id": "mild_load",
                "name": "Mild-Load Bufferbloat Comparison",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Workload",
                "duration_ms": 100.0,
                "measured_values": {"baseline_rtt_ms": 18.0, "loaded_rtt_ms": 22.0, "delta_ms": 4.0, "ratio": 1.22},
                "interpretation": "[SIMULATED] Normal buffer queue behavior.",
            },
        }

    elif scenario == "packet_loss":
        tests = {
            "gateway": {
                "test_id": "gateway",
                "name": "Default Gateway Reachability",
                "status": "pass",
                "target": "192.168.1.1 (SIMULATED)",
                "method": "Simulated ICMP Echo",
                "duration_ms": 10.0,
                "measured_values": {"gateway_ip": "192.168.1.1", "packet_loss_pct": 0.0, "rtt_avg_ms": 2.1},
                "interpretation": "[SIMULATED] Gateway LAN hop is healthy with zero loss.",
            },
            "dns": {
                "test_id": "dns",
                "name": "DNS Resolution Latency",
                "status": "pass",
                "target": "google.com",
                "method": "Simulated Resolver",
                "duration_ms": 25.0,
                "measured_values": {"hostname": "google.com", "resolution_time_ms": 24.0, "ip_count": 2},
                "interpretation": "[SIMULATED] DNS resolution operational.",
            },
            "external_icmp": {
                "test_id": "external_icmp",
                "name": "External ICMP Echo",
                "status": "warning",
                "target": "1.1.1.1",
                "method": "Simulated Ping",
                "duration_ms": 80.0,
                "measured_values": {"target": "1.1.1.1", "packet_loss_pct": 35.0, "rtt_avg_ms": 28.5},
                "interpretation": "[SIMULATED] External edge experiencing 35% packet loss.",
            },
            "external_http": {
                "test_id": "external_http",
                "name": "External HTTP Verification",
                "status": "warning",
                "target": "https://connectivitycheck.gstatic.com",
                "method": "Simulated HTTP",
                "duration_ms": 150.0,
                "measured_values": {"status_code": 204, "http_rtt_ms": 140.0},
                "interpretation": "[SIMULATED] HTTP request experienced retransmissions.",
            },
            "packet_loss": {
                "test_id": "packet_loss",
                "name": "End-to-End Packet Loss & Latency",
                "status": "fail",
                "target": "1.1.1.1",
                "method": "Simulated Burst",
                "duration_ms": 120.0,
                "measured_values": {"packet_loss_pct": 40.0, "rtt_avg_ms": 32.0},
                "interpretation": "[SIMULATED] Severe 40% packet loss measured on WAN path.",
            },
            "mild_load": {
                "test_id": "mild_load",
                "name": "Mild-Load Bufferbloat Comparison",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Workload",
                "duration_ms": 90.0,
                "measured_values": {"baseline_rtt_ms": 28.0, "loaded_rtt_ms": 34.0, "delta_ms": 6.0, "ratio": 1.21},
                "interpretation": "[SIMULATED] Bufferbloat low.",
            },
        }

    else:  # bufferbloat default
        tests = {
            "gateway": {
                "test_id": "gateway",
                "name": "Default Gateway Reachability",
                "status": "pass",
                "target": "192.168.1.1 (SIMULATED)",
                "method": "Simulated ICMP Echo",
                "duration_ms": 8.0,
                "measured_values": {"gateway_ip": "192.168.1.1", "packet_loss_pct": 0.0, "rtt_avg_ms": 2.2},
                "interpretation": "[SIMULATED] Gateway LAN hop is healthy.",
            },
            "dns": {
                "test_id": "dns",
                "name": "DNS Resolution Latency",
                "status": "pass",
                "target": "google.com",
                "method": "Simulated Resolver",
                "duration_ms": 18.0,
                "measured_values": {"hostname": "google.com", "resolution_time_ms": 17.5, "ip_count": 2},
                "interpretation": "[SIMULATED] DNS resolution healthy.",
            },
            "external_icmp": {
                "test_id": "external_icmp",
                "name": "External ICMP Echo",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Ping",
                "duration_ms": 35.0,
                "measured_values": {"target": "1.1.1.1", "packet_loss_pct": 0.0, "rtt_avg_ms": 20.0},
                "interpretation": "[SIMULATED] Public edge reachable.",
            },
            "external_http": {
                "test_id": "external_http",
                "name": "External HTTP Verification",
                "status": "pass",
                "target": "https://connectivitycheck.gstatic.com",
                "method": "Simulated HTTP",
                "duration_ms": 40.0,
                "measured_values": {"status_code": 204, "http_rtt_ms": 38.0},
                "interpretation": "[SIMULATED] HTTP access confirmed.",
            },
            "packet_loss": {
                "test_id": "packet_loss",
                "name": "End-to-End Packet Loss & Latency",
                "status": "pass",
                "target": "1.1.1.1",
                "method": "Simulated Burst",
                "duration_ms": 45.0,
                "measured_values": {"packet_loss_pct": 0.0, "rtt_avg_ms": 21.0},
                "interpretation": "[SIMULATED] 0% packet loss.",
            },
            "mild_load": {
                "test_id": "mild_load",
                "name": "Mild-Load Bufferbloat Comparison",
                "status": "fail",
                "target": "1.1.1.1",
                "method": "Simulated Workload",
                "duration_ms": 120.0,
                "measured_values": {"baseline_rtt_ms": 20.0, "loaded_rtt_ms": 145.0, "delta_ms": 125.0, "ratio": 7.25},
                "interpretation": "[SIMULATED] Latency spiked +125ms under mild load (7.25x baseline).",
            },
        }

    # Evaluate simulated tests through the real deterministic rule engine
    diagnosis_output = evaluate_diagnostic_evidence(tests)

    # Clearly tag that this is a simulated diagnosis
    diagnosis_output["primary_diagnosis"] = f"[SIMULATED] {diagnosis_output['primary_diagnosis']}"
    diagnosis_output["summary"] = f"[CONTROLLED FAULT INJECTION SANDBOX] {diagnosis_output['summary']}"

    sim_session = {
        "session_id": session_id,
        "created_at": now_iso,
        "completed_at": now_iso,
        "status": "completed",
        "client_ip": "SIMULATION-SANDBOX",
        "tests": tests,
        "diagnosis": diagnosis_output,
        "progress_pct": 100,
        "is_simulated": True,
        "user_id": user_id,
    }

    storage.save_session(sim_session)
    return sim_session


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host=host, port=port, reload=True)
