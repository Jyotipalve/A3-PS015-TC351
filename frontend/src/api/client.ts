import {
  HealthResponse,
  AgentStatusResponse,
  DiagnosticSession,
  RunDiagnosisRequest,
  User,
} from '../types';

// Use VITE_API_BASE_URL if explicitly set, otherwise use relative path so Vite proxy handles /api
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== '')
  ? import.meta.env.VITE_API_BASE_URL
  : '';

const TOKEN_STORAGE_KEY = 'netexplain_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach JWT Bearer token if present
  const token = getStoredToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only attach Content-Type if a body is present to avoid unnecessary CORS preflight on GET requests
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include HttpOnly cookies for authenticated sessions
      signal: options.signal || AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      let errorMsg = `Request to ${endpoint} failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch {
        // use default errorMsg
      }
      throw new ApiError(errorMsg, response.status);
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new ApiError(`Network connection failure (${endpoint}): ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Health & Diagnostics API
// ---------------------------------------------------------------------------

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}

export async function fetchAgentStatus(): Promise<AgentStatusResponse> {
  return request<AgentStatusResponse>('/api/agent/status');
}

export async function startFullDiagnosis(params: RunDiagnosisRequest = {}): Promise<DiagnosticSession> {
  return request<DiagnosticSession>('/api/run-full-diagnosis', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function pollDiagnosisSession(sessionId: string): Promise<DiagnosticSession> {
  return request<DiagnosticSession>(`/api/diagnosis/session/${sessionId}`);
}

export async function cancelDiagnosisSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return request<{ status: string; session_id: string }>(`/api/diagnosis/session/${sessionId}/cancel`, {
    method: 'POST',
  });
}

export async function fetchDiagnosisHistory(limit: number = 20, includeSimulated: boolean = true): Promise<DiagnosticSession[]> {
  return request<DiagnosticSession[]>(`/api/diagnosis/history?limit=${limit}&include_simulated=${includeSimulated}`);
}

export async function clearDiagnosisHistory(): Promise<{ status: string; operator: string }> {
  return request<{ status: string; operator: string }>('/api/diagnosis/history', {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Controlled Fault Simulation Sandbox API
// ---------------------------------------------------------------------------

export async function runSimulation(scenario: string): Promise<DiagnosticSession> {
  return request<DiagnosticSession>('/api/simulation/run', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });
}

// ---------------------------------------------------------------------------
// Authentication API
// ---------------------------------------------------------------------------

export async function registerUser(username: string, password: string, displayName?: string): Promise<User> {
  const user = await request<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, display_name: displayName }),
  });
  if (user.access_token) {
    setStoredToken(user.access_token);
  }
  return user;
}

export async function loginUser(username: string, password: string): Promise<User> {
  const user = await request<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (user.access_token) {
    setStoredToken(user.access_token);
  }
  return user;
}

export async function logoutUser(): Promise<{ status: string }> {
  try {
    return await request<{ status: string }>('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    setStoredToken(null);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>('/api/auth/me');
  } catch {
    return null;
  }
}

export { API_BASE_URL };
