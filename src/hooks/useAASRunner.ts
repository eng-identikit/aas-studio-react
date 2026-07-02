import { useApiWrapper } from '@/api/apiWrapper';

// Debug AAS server lifecycle. The browser never reaches aas-server-runner
// directly: every call goes through aas-studio-api (/v1/runner/*), which
// forwards to the runner control API and cascades the response back.

export const DEBUG_SERVER_PORT = 6789;

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
  /** Browser-reachable base URL of the debug server, computed by the API. */
  debugUrl: string | null;
}

export const useAASRunner = () => {
  const api = useApiWrapper();
  const BASE = '/v1/runner';

  /** Deploy the AAS environment and start (or redeploy) the debug server. */
  const start = (environment: unknown, port: number = DEBUG_SERVER_PORT) =>
    api.post<RunnerStatus>(`${BASE}/start`, { environment, port });

  /** Stop the debug server. */
  const stop = () => api.post<RunnerStatus>(`${BASE}/stop`);

  /** Current lifecycle state (statusCode 503 ⇒ runner unreachable). */
  const status = () => api.get<RunnerStatus>(`${BASE}/status`);

  /** Last stdout/stderr lines of the debug server. */
  const logs = (tail = 200) => api.get<{ lines: string[] }>(`${BASE}/logs?tail=${tail}`);

  return { start, stop, status, logs };
};
