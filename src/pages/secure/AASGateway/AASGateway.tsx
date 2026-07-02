import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CloudDownloadRounded,
  Inventory2Rounded,
  LanRounded,
  LinkOffRounded,
  RefreshRounded,
  SchemaRounded,
  WarningAmberRounded,
} from '@mui/icons-material';

import { useAASRemote, type RemoteShellSummary, type RemoteSubmodel } from '@/hooks/useAASRemote';
import { mapEnvironmentToModel } from '@/utils/aas-mapper';
import { useAASContext } from '@/context/AASContext';
import { useDialogContext } from '@/context/DialogContext';
import { useCustomSnackbar } from '@/context/SnackbarContext';
import GatewayConnectDialog, { type GatewayConnection } from './dialogs/GatewayConnectDialog';

interface ShellGroup {
  shell: RemoteShellSummary;
  submodels: RemoteSubmodel[];
  unresolved: string[];
}

function refToSubmodelId(ref: unknown): string | null {
  const keys = Array.isArray((ref as any)?.keys) ? (ref as any).keys : [];
  const smKey = keys.find((k: any) => k?.type === 'Submodel') || keys[keys.length - 1];
  return smKey?.value ?? null;
}

function submodelDescription(sm: RemoteSubmodel): string {
  return sm.description?.[0]?.text ?? '';
}

export default function AASGateway() {
  const { importAas } = useAASContext();
  const { listShells, listSubmodels, pull } = useAASRemote();
  const { setHandlers } = useDialogContext();
  const { showSnackbar } = useCustomSnackbar();
  const navigate = useNavigate();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [conn, setConn] = useState<GatewayConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [shells, setShells] = useState<RemoteShellSummary[]>([]);
  const [submodels, setSubmodels] = useState<RemoteSubmodel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    setHandlers({ onConnectServer: () => setShowConnectDialog(true) });
    return () => setHandlers({});
  }, [setHandlers]);

  const refresh = async (c: GatewayConnection) => {
    setLoading(true);
    setError(null);
    try {
      const [shellsRes, subsRes] = await Promise.all([
        listShells(c.baseUrl, c.auth),
        listSubmodels(c.baseUrl, c.auth),
      ]);
      if (shellsRes.status !== 'Success') throw new Error(shellsRes.message || 'Impossibile elencare le shells');
      if (subsRes.status !== 'Success') throw new Error(subsRes.message || 'Impossibile elencare i submodels');
      setShells(shellsRes.data?.shells ?? []);
      setSubmodels(subsRes.data?.submodels ?? []);
    } catch (err: any) {
      setError(err?.message || 'Errore durante la lettura del server');
      setShells([]);
      setSubmodels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnected = (c: GatewayConnection) => {
    setConn(c);
    refresh(c);
  };

  const handleDisconnect = () => {
    setConn(null);
    setShells([]);
    setSubmodels([]);
    setError(null);
  };

  const handleImport = async (shellId: string) => {
    if (!conn) return;
    setImporting(shellId);
    try {
      const res = await pull(conn.baseUrl, conn.auth, shellId);
      if (res.status !== 'Success' || !res.data?.shell) {
        throw new Error(res.message || 'Pull fallito');
      }
      const model = mapEnvironmentToModel(
        { shell: res.data.shell, submodels: res.data.submodels ?? [] },
        { idPrefix: 'remote' },
      );
      importAas(model);
      const failed = res.data.failed?.length ?? 0;
      showSnackbar(
        `Importato "${model.idShort}" nell'editor — ${model.submodels.length} submodel${failed ? `, ${failed} non risolti` : ''}`,
        failed ? 'warning' : 'success',
      );
      navigate('/editor');
    } catch (err: any) {
      showSnackbar(err?.message || "Errore durante l'import", 'error');
    } finally {
      setImporting(null);
    }
  };

  // Group the server-wide submodel listing by referencing shell.
  const submodelById = new Map(submodels.map(s => [s.id, s]));
  const referenced = new Set<string>();
  const groups: ShellGroup[] = shells.map(shell => {
    const ids = (Array.isArray(shell.submodels) ? shell.submodels : [])
      .map(refToSubmodelId)
      .filter((id): id is string => Boolean(id));
    ids.forEach(id => referenced.add(id));
    return {
      shell,
      submodels: ids.map(id => submodelById.get(id)).filter((s): s is RemoteSubmodel => Boolean(s)),
      unresolved: ids.filter(id => !submodelById.has(id)),
    };
  });
  const orphans = submodels.filter(s => !referenced.has(s.id));

  const hostLabel = conn ? (() => {
    try { return new URL(conn.baseUrl).host; } catch { return conn.baseUrl; }
  })() : '';

  // ── Empty state: not connected ──
  if (!conn) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Stack alignItems="center" spacing={1.5} sx={{ maxWidth: 440, textAlign: 'center' }}>
          <LanRounded sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6" fontWeight={600}>Nessun AAS server collegato</Typography>
          <Typography variant="body2" color="text.secondary">
            Collegati a un server AAS (IDTA 01002-3-0 Part 2) per esplorare shells e submodels
            e importarli nell'editor.
          </Typography>
          <Button
            variant="contained"
            startIcon={<LanRounded />}
            onClick={() => setShowConnectDialog(true)}
            sx={{ mt: 1 }}
          >
            Connetti a un AAS server
          </Button>
        </Stack>
        <GatewayConnectDialog
          open={showConnectDialog}
          onClose={() => setShowConnectDialog(false)}
          onConnected={handleConnected}
        />
      </Box>
    );
  }

  const stats: [string, number][] = [
    ['Shells', shells.length],
    ['Submodels', submodels.length],
    ['Profiles', conn.profiles.length],
  ];

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header (same layout as the AAS Editor toolbar) ── */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap flexWrap="wrap">
          <LanRounded sx={{ fontSize: 22, color: 'primary.main', flexShrink: 0 }} />
          <Typography fontFamily="monospace" fontWeight={700} fontSize={18} noWrap sx={{ maxWidth: 340 }}>
            {hostLabel}
          </Typography>

          <Chip size="small" variant="outlined" color="success" label="Connesso" />

          <Typography
            variant="caption"
            fontFamily="monospace"
            sx={{ px: 1, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, color: 'text.secondary', userSelect: 'none' }}
          >
            IDTA&nbsp;01002-3-0
          </Typography>
        </Stack>

        {/* Metadata row — actions aligned right */}
        <Stack direction="row" alignItems="center" spacing={2} useFlexGap flexWrap="wrap" mt={1}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>baseUrl</Typography>
            <Typography variant="caption" fontFamily="monospace" noWrap sx={{ maxWidth: 320 }}>
              {conn.baseUrl}
            </Typography>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
          {stats.map(([k, v]) => (
            <Typography key={k} variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {k}{' '}
              <Box component="span" sx={{ color: 'primary.main', fontFamily: 'monospace', fontWeight: 600 }}>{v}</Box>
            </Typography>
          ))}

          <Stack direction="row" spacing={1} sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshRounded />}
              onClick={() => refresh(conn)}
              disabled={loading}
            >
              Aggiorna
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<LinkOffRounded />}
              onClick={handleDisconnect}
            >
              Disconnetti
            </Button>
          </Stack>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ flexShrink: 0 }} />}

      {/* ── Body: shells with their submodels ── */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
        {error ? (
          <Stack alignItems="center" spacing={1} mt={6}>
            <WarningAmberRounded sx={{ fontSize: 36, color: 'error.main' }} />
            <Typography variant="body2" color="error.main">{error}</Typography>
            <Button size="small" variant="outlined" startIcon={<RefreshRounded />} onClick={() => refresh(conn)}>
              Riprova
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {groups.map(({ shell, submodels: smList, unresolved }) => (
              <Paper key={shell.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap flexWrap="wrap">
                  <Inventory2Rounded sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontFamily="monospace" fontWeight={700} noWrap>
                      {shell.idShort || shell.id}
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" color="text.disabled" noWrap display="block">
                      {shell.id}
                    </Typography>
                  </Box>
                  {shell.assetInformation?.assetKind && (
                    <Chip size="small" variant="outlined" label={shell.assetInformation.assetKind} sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                  )}
                  <Box flexGrow={1} />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={importing === shell.id
                      ? <CircularProgress size={14} color="inherit" />
                      : <CloudDownloadRounded />}
                    onClick={() => handleImport(shell.id)}
                    disabled={importing !== null}
                  >
                    {importing === shell.id ? 'Importazione…' : "Importa nell'editor"}
                  </Button>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                {smList.length === 0 && unresolved.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    Nessun submodel referenziato da questa shell.
                  </Typography>
                ) : (
                  <Stack spacing={0.25}>
                    {smList.map(sm => (
                      <Stack key={sm.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.6, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                        <SchemaRounded sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600} noWrap>
                          {sm.idShort || sm.id}
                        </Typography>
                        {submodelDescription(sm) && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0, flex: 1 }}>
                            {submodelDescription(sm)}
                          </Typography>
                        )}
                        {!submodelDescription(sm) && <Box flexGrow={1} />}
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${sm.submodelElements?.length ?? 0} elementi`}
                          sx={{ fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}
                        />
                      </Stack>
                    ))}
                    {unresolved.map(id => (
                      <Stack key={id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.6, px: 1 }}>
                        <WarningAmberRounded sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
                        <Typography variant="caption" fontFamily="monospace" color="text.disabled" noWrap>
                          {id}
                        </Typography>
                        <Chip size="small" variant="outlined" color="warning" label="non risolto" sx={{ fontSize: 10 }} />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Paper>
            ))}

            {orphans.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <SchemaRounded sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Typography fontWeight={700}>Submodels non referenziati</Typography>
                  <Chip size="small" variant="outlined" label={orphans.length} sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={0.25}>
                  {orphans.map(sm => (
                    <Stack key={sm.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.6, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                      <SchemaRounded sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                      <Typography variant="body2" fontFamily="monospace" fontWeight={600} noWrap>
                        {sm.idShort || sm.id}
                      </Typography>
                      <Box flexGrow={1} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${sm.submodelElements?.length ?? 0} elementi`}
                        sx={{ fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}

            {groups.length === 0 && orphans.length === 0 && !loading && (
              <Stack alignItems="center" spacing={1} mt={6}>
                <Inventory2Rounded sx={{ fontSize: 36, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">
                  Il server non espone né shells né submodels.
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      <GatewayConnectDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        onConnected={handleConnected}
      />
    </Box>
  );
}
