// Client for the aas-server-runner control API (separate microservice, no
// auth: local dev tooling). The runner launches the IDTA debug AAS server on
// the standard debug port (6789) with the environment we POST to it.

export const RUNNER_URL: string = import.meta.env.VITE_RUNNER_URL || 'http://localhost:6790';
export const DEBUG_SERVER_PORT = 6789;
export const DEBUG_SERVER_URL = `http://localhost:${DEBUG_SERVER_PORT}`;

export interface RunnerModelSummary {
  idShort: string | null;
  version: string | null;
  shells: number;
  submodels: number;
}

export interface RunnerStatus {
  running: boolean;
  port: number;
  pid: number | null;
  startedAt: string | null;
  uptimeSeconds: number;
  exitCode: number | null;
  model: RunnerModelSummary | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RUNNER_URL}${path}`, init);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const runnerApi = {
  start: (environment: unknown, port: number = DEBUG_SERVER_PORT) =>
    request<RunnerStatus>('/runner/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment, port }),
    }),

  stop: () => request<RunnerStatus>('/runner/stop', { method: 'POST' }),

  status: () => request<RunnerStatus>('/runner/status'),

  logs: (tail = 200) => request<{ lines: string[] }>(`/runner/logs?tail=${tail}`),
};
