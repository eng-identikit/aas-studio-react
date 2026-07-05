import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { RemoteShellSummary, RemoteSubmodel } from '@/hooks/useAASRemote';
import type { GatewayConnection } from '@/pages/secure/AASGateway/dialogs/GatewayConnectDialog';

// Connection to a live AAS server (Gateway). Lives at app level so navigating
// away from the Gateway page does not drop the connection or the fetched
// listing. In-memory only: credentials are not persisted to storage.
interface GatewayContextType {
  conn: GatewayConnection | null;
  shells: RemoteShellSummary[];
  submodels: RemoteSubmodel[];
  error: string | null;
  setConn: (c: GatewayConnection | null) => void;
  setShells: (s: RemoteShellSummary[]) => void;
  setSubmodels: (s: RemoteSubmodel[]) => void;
  setError: (e: string | null) => void;
  disconnect: () => void;
}

const GatewayContext = createContext<GatewayContextType | null>(null);

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<GatewayConnection | null>(null);
  const [shells, setShells] = useState<RemoteShellSummary[]>([]);
  const [submodels, setSubmodels] = useState<RemoteSubmodel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    setConn(null);
    setShells([]);
    setSubmodels([]);
    setError(null);
  }, []);

  const value = useMemo(() => ({
    conn, shells, submodels, error,
    setConn, setShells, setSubmodels, setError, disconnect,
  }), [conn, shells, submodels, error, disconnect]);

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGatewayContext() {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error('useGatewayContext must be used within GatewayProvider');
  return ctx;
}
