import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloseRounded,
  ErrorOutlineRounded,
  LanRounded,
} from '@mui/icons-material';

import { useAASRemote, type RemoteAuth } from '@/hooks/useAASRemote';

type AuthType = 'none' | 'bearer' | 'basic';

export interface GatewayConnection {
  baseUrl: string;
  auth: RemoteAuth;
  profiles: string[];
}

interface GatewayConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: (conn: GatewayConnection) => void;
}

export default function GatewayConnectDialog({ open, onClose, onConnected }: GatewayConnectDialogProps) {
  const { ping } = useAASRemote();

  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pinging, setPinging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildAuth = (): RemoteAuth => {
    if (authType === 'bearer') return { type: 'bearer', token };
    if (authType === 'basic') return { type: 'basic', username, password };
    return { type: 'none' };
  };

  const handleConnect = async () => {
    if (!baseUrl.trim()) return;
    setPinging(true);
    setError(null);
    try {
      const auth = buildAuth();
      const res = await ping(baseUrl.trim(), auth);
      if (res.status !== 'Success' || !res.data?.reachable) {
        setError(res.message || `Server non raggiungibile${res.data?.statusCode ? ` (HTTP ${res.data.statusCode})` : ''}`);
        return;
      }
      onConnected({ baseUrl: baseUrl.trim(), auth, profiles: res.data.profiles ?? [] });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Errore di connessione');
    } finally {
      setPinging(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LanRounded color="primary" />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Connetti a un AAS Server
          </Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace">
            IDTA 01002-3-0 Part 2 · repository remoto
          </Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Base URL del server"
          size="small"
          fullWidth
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:6789"
          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
        />

        <Stack direction="row" spacing={1.5}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Autenticazione</InputLabel>
            <Select
              label="Autenticazione"
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
            >
              <MenuItem value="none">Nessuna</MenuItem>
              <MenuItem value="bearer">Bearer token</MenuItem>
              <MenuItem value="basic">Basic auth</MenuItem>
            </Select>
          </FormControl>

          {authType === 'bearer' && (
            <TextField
              label="Token" size="small" fullWidth type="password"
              value={token} onChange={(e) => setToken(e.target.value)}
            />
          )}
          {authType === 'basic' && (
            <>
              <TextField label="Username" size="small" fullWidth
                value={username} onChange={(e) => setUsername(e.target.value)} />
              <TextField label="Password" size="small" fullWidth type="password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
        </Stack>

        {error && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'error.main' }}>
            <ErrorOutlineRounded fontSize="small" />
            <Typography variant="caption">{error}</Typography>
          </Stack>
        )}

        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={!baseUrl.trim() || pinging}
          startIcon={pinging ? <CircularProgress size={14} color="inherit" /> : <LanRounded />}
        >
          {pinging ? 'Connessione…' : 'Connetti'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
