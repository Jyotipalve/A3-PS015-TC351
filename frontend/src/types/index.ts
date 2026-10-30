export type ApiConnectionStatus = 'connecting' | 'connected' | 'unavailable';

export interface User {
  user_id: string;
  username: string;
  display_name?: string;
  created_at: string;
  access_token?: string;
  token_type?: string;
}

export interface HealthResponse {
  status: string;
  api_version: string;
  phase: string;
  message: string;
}

export interface AgentCapability {
  name: string;
  enabled: boolean;
  description: string;
}

export interface AgentStatusResponse {
  api_available: boolean;
  measurement_engine: string;
  phase: string;
  message: string;
  capabilities: AgentCapability[];
}

export type TestStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'pass'
  | 'fail'
  | 'warning'
  | 'inconclusive'
  | 'skipped';

export interface SingleTestResult {
  test_id: string;
  name: string;
  status: TestStatus;
  target: string;
  method: string;
  start_time?: string;
  end_time?: string;
  duration_ms?: number;
  measured_values: Record<string, any>;
  error_details?: string;
  interpretation?: string;
}

export interface DiagnosticHypothesis {
  hypothesis: string;
  state: 'supported' | 'contradicted' | 'untested';
  reason: string;
}

export interface DiagnosticEvidence {
  primary_diagnosis: string;
  severity: 'healthy' | 'warning' | 'critical' | 'inconclusive';
  summary: string;
  observed_evidence: string[];
  hypotheses: DiagnosticHypothesis[];
  confidence: 'High' | 'Moderate' | 'Low';
  confidence_explanation: string;
  alternative_explanations: string[];
  next_recommended_test: string;
  resolution_steps: string[];
}

export interface DiagnosticSession {
  session_id: string;
  created_at: string;
  completed_at?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  client_ip?: string;
  tests: Record<string, SingleTestResult>;
  diagnosis?: DiagnosticEvidence;
  progress_pct: number;
  summary?: string;
  is_simulated?: boolean;
  user_id?: string;
}

export interface RunDiagnosisRequest {
  gateway_override?: string;
  dns_hostname?: string;
  icmp_target?: string;
  http_target?: string;
}

export interface SimulationRequest {
  scenario: string;
}
