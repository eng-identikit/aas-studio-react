import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountTreeRounded,
  AddRounded,
  CallMergeRounded,
  CheckCircleOutlineRounded,
  ChevronRightRounded,
  CloseRounded,
  CompareArrowsRounded,
  ExpandMoreRounded,
  HistoryRounded,
  RestoreRounded,
  SaveRounded,
} from '@mui/icons-material';

import {
  useAASVersioning,
  type AASCommit,
  type AASRef,
  type CommitStatus,
} from '@/hooks/useAASVersioning';
import type { SubmodelTemplate } from '@/context/AASContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAWER_WIDTH = 380;

const STATUS_COLOR: Record<CommitStatus, 'success' | 'warning' | 'default'> = {
  Active: 'success',
  Draft: 'warning',
  Deprecated: 'default',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortHash(hash: string) {
  return hash.slice(0, 7);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface CommitRowProps {
  commit: AASCommit;
  isHead: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onCheckout: (commitId: number) => void;
  onRestore: (commitId: number) => void;
  onStatusChange: (commitId: number, status: CommitStatus) => void;
  loading: boolean;
}

function CommitRow({
  commit, isHead, isSelected,
  onSelect, onCheckout, onRestore, onStatusChange, loading,
}: CommitRowProps) {
  return (
    <Box
      onClick={onSelect}
      sx={{
        px: 1.5, py: 1.25,
        cursor: 'pointer',
        borderRadius: 1,
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'rgba(99,102,241,.07)' : 'background.paper',
        '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(99,102,241,.04)' },
        transition: 'all .15s',
      }}
    >
      {/* Top row: hash + status + HEAD badge */}
      <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
        <Typography variant="caption" fontFamily="monospace" color="primary.main" fontWeight={700}>
          {shortHash(commit.commit_hash)}
        </Typography>
        {isHead && (
          <Chip label="HEAD" size="small" color="primary" sx={{ height: 16, fontSize: 9, fontFamily: 'monospace' }} />
        )}
        <Box flex={1} />
        <Chip
          label={commit.status}
          size="small"
          color={STATUS_COLOR[commit.status]}
          variant="outlined"
          sx={{ height: 16, fontSize: 9 }}
        />
      </Stack>

      {/* Message */}
      <Typography variant="body2" fontWeight={500} noWrap sx={{ mb: 0.25 }}>
        {commit.message}
      </Typography>

      {/* Meta: version + date */}
      <Typography variant="caption" color="text.disabled" fontFamily="monospace">
        v{commit.version} rev {commit.revision} · {fmtDate(commit.createdAt)}
      </Typography>

      {/* Actions (visible only when selected) */}
      <Collapse in={isSelected}>
        <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" useFlexGap>
          <Tooltip title="Carica questo snapshot nell'editor">
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryRounded sx={{ fontSize: 13 }} />}
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); onCheckout(commit.commit_id); }}
              sx={{ fontSize: 10, py: 0.25 }}
            >
              Checkout
            </Button>
          </Tooltip>
          <Tooltip title="Crea un nuovo commit che ripristina questo snapshot">
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<RestoreRounded sx={{ fontSize: 13 }} />}
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); onRestore(commit.commit_id); }}
              sx={{ fontSize: 10, py: 0.25 }}
            >
              Restore
            </Button>
          </Tooltip>
          {commit.status !== 'Active' && (
            <Tooltip title="Promuovi a Active (depreca il precedente Active)">
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckCircleOutlineRounded sx={{ fontSize: 13 }} />}
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); onStatusChange(commit.commit_id, 'Active'); }}
                sx={{ fontSize: 10, py: 0.25 }}
              >
                Set Active
              </Button>
            </Tooltip>
          )}
        </Stack>

        {/* Diff entries */}
        {commit.diffs && commit.diffs.length > 0 && (
          <Box mt={1} pl={0.5}>
            {commit.diffs.map((d) => (
              <Stack key={d.diff_id} direction="row" alignItems="center" spacing={0.5} py={0.15}>
                <Box
                  sx={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    bgcolor: d.change_type === 'added' ? 'success.main' : d.change_type === 'removed' ? 'error.main' : 'warning.main',
                  }}
                />
                <Typography variant="caption" color="text.disabled" fontFamily="monospace" noWrap>
                  <Box component="span" color="text.secondary">{d.target}</Box>
                  {' · '}{d.name}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface ModelData {
  idShort: string;
  assetId: string;
  assetKind: 'Instance' | 'Type';
  description: string;
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  documentId: number | null;
  submodels: SubmodelTemplate[];
  modelData: ModelData;
  onCheckoutContent: (content: any) => void;
  onDocumentCreated: (id: number) => void;
}

export default function VersionHistoryDrawer({
  open, onClose, documentId, submodels, modelData, onCheckoutContent, onDocumentCreated,
}: VersionHistoryDrawerProps) {
  const versioning = useAASVersioning();

  const [commits, setCommits] = useState<AASCommit[]>([]);
  const [refs, setRefs] = useState<AASRef[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>('HEAD');
  const [selectedCommitId, setSelectedCommitId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New commit form
  const [commitMsg, setCommitMsg] = useState('');
  const [showCommitForm, setShowCommitForm] = useState(false);

  // New branch form
  const [branchName, setBranchName] = useState('');
  const [showBranchForm, setShowBranchForm] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const [logRes, refsRes] = await Promise.all([
        versioning.getLog(documentId, { ref: selectedRef === 'ALL' ? undefined : selectedRef }),
        versioning.listRefs(documentId),
      ]);
      if (logRes.status === 'Success') setCommits(logRes.data.commits);
      else setError(logRes.message);
      if (refsRes.status === 'Success') setRefs(refsRes.data.refs);
    } catch {
      setError('Errore nel caricamento della history');
    } finally {
      setLoading(false);
    }
  }, [documentId, selectedRef]);

  useEffect(() => {
    if (open && documentId) loadData();
  }, [open, documentId, loadData]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleCheckout = async (commitId: number) => {
    if (!documentId) return;
    setActionLoading(true);
    try {
      const res = await versioning.checkout(documentId, { commit_id: commitId });
      if (res.status === 'Success' && res.data.content) {
        onCheckoutContent(res.data.content);
      } else {
        setError(res.message || 'Checkout fallito');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (commitId: number) => {
    if (!documentId) return;
    setActionLoading(true);
    try {
      const res = await versioning.restoreCommit(documentId, commitId);
      if (res.status === 'Success') await loadData();
      else setError(res.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (commitId: number, status: CommitStatus) => {
    if (!documentId) return;
    setActionLoading(true);
    try {
      const res = await versioning.setCommitStatus(documentId, commitId, status);
      if (res.status === 'Success') await loadData();
      else setError(res.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      let docId = documentId;

      if (!docId) {
        const aasId = `urn:aas-studio:${modelData.idShort.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${Date.now()}`;
        const createRes = await versioning.createDocument({
          id_short: modelData.idShort,
          aas_id: aasId,
          asset_id: modelData.assetId,
          asset_kind: modelData.assetKind,
          description: modelData.description,
          message: commitMsg.trim(),
          content: { submodels },
        });
        if (createRes.status !== 'Success') {
          setError(createRes.message);
          return;
        }
        docId = createRes.data.document.document_id;
        onDocumentCreated(docId);
        setCommitMsg('');
        setShowCommitForm(false);
        await loadData();
        return;
      }

      const content = { submodels };
      const res = await versioning.commitSubmodel(docId, {
        message: commitMsg.trim(),
        content,
        ref: selectedRef === 'ALL' ? 'HEAD' : selectedRef,
      });
      if (res.status === 'Success') {
        setCommitMsg('');
        setShowCommitForm(false);
        await loadData();
      } else {
        setError(res.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!documentId || !branchName.trim()) return;
    setActionLoading(true);
    try {
      const res = await versioning.createBranch(documentId, branchName.trim());
      if (res.status === 'Success') {
        setBranchName('');
        setShowBranchForm(false);
        await loadData();
      } else {
        setError(res.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSwitchBranch = async (refName: string) => {
    if (!documentId || refName === 'HEAD' || refName === 'ALL') return;
    setActionLoading(true);
    try {
      const res = await versioning.switchBranch(documentId, refName);
      if (res.status === 'Success') await loadData();
      else setError(res.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Refs derived data ─────────────────────────────────────────────────

  const headRef = refs.find(r => r.ref_name === 'HEAD');
  const branches = refs.filter(r => r.ref_name !== 'HEAD');

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderLeft: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          top: 0,
          height: '100%',
        },
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
      >
        <HistoryRounded sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight={700} flex={1}>
          Version History
        </Typography>
        {(loading || actionLoading) && <CircularProgress size={14} />}
        <IconButton size="small" onClick={onClose}>
          <CloseRounded sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* Ref / Branch selector */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccountTreeRounded sx={{ fontSize: 15, color: 'text.secondary' }} />
          <FormControl size="small" sx={{ flex: 1 }}>
            <Select
              value={selectedRef}
              onChange={(e) => setSelectedRef(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: 11 }}
            >
              <MenuItem value="ALL" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                — tutti i commit —
              </MenuItem>
              <MenuItem value="HEAD" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                HEAD {headRef?.commit ? `(${shortHash(headRef.commit.commit_hash)})` : ''}
              </MenuItem>
              {branches.map(r => (
                <MenuItem key={r.ref_name} value={r.ref_name} sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {r.ref_name}
                  {r.commit ? ` (${shortHash(r.commit.commit_hash)})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedRef !== 'HEAD' && selectedRef !== 'ALL' && (
            <Tooltip title={`Sposta HEAD su branch '${selectedRef}'`}>
              <IconButton
                size="small"
                onClick={() => handleSwitchBranch(selectedRef)}
                disabled={actionLoading}
              >
                <CallMergeRounded sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Action buttons */}
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SaveRounded sx={{ fontSize: 13 }} />}
          onClick={() => { setShowCommitForm(v => !v); setShowBranchForm(false); }}
          sx={{ fontSize: 10 }}
        >
          Commit
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddRounded sx={{ fontSize: 13 }} />}
          onClick={() => { setShowBranchForm(v => !v); setShowCommitForm(false); }}
          sx={{ fontSize: 10 }}
        >
          Branch
        </Button>
        <Box flex={1} />
        <Tooltip title="Confronta due commit selezionati">
          <span>
            <IconButton size="small" disabled>
              <CompareArrowsRounded sx={{ fontSize: 15 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Commit form */}
      <Collapse in={showCommitForm}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(99,102,241,.04)' }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Commit del submodel corrente
          </Typography>
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Messaggio del commit…"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              disabled={!commitMsg.trim() || actionLoading}
              onClick={handleCommit}
              startIcon={actionLoading ? <CircularProgress size={12} /> : <SaveRounded sx={{ fontSize: 13 }} />}
              sx={{ fontSize: 10 }}
            >
              Salva
            </Button>
            <Button size="small" onClick={() => setShowCommitForm(false)} sx={{ fontSize: 10 }}>
              Annulla
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* Branch form */}
      <Collapse in={showBranchForm}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(99,102,241,.04)' }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Crea branch da HEAD corrente
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Nome branch (es. release-2.0)…"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              disabled={!branchName.trim() || actionLoading}
              onClick={handleCreateBranch}
              sx={{ fontSize: 10 }}
            >
              Crea
            </Button>
            <Button size="small" onClick={() => setShowBranchForm(false)} sx={{ fontSize: 10 }}>
              Annulla
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'error.main', flexShrink: 0 }}>
          <Typography variant="caption" color="white">{error}</Typography>
        </Box>
      )}

      {/* Commit list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        {loading && !commits.length ? (
          <Stack alignItems="center" justifyContent="center" height={120}>
            <CircularProgress size={24} />
          </Stack>
        ) : !documentId && commits.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" height={120} spacing={1} px={2}>
            <HistoryRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" textAlign="center">
              Nessun documento collegato al backend. Usa <strong>Commit</strong> per creare il primo snapshot.
            </Typography>
          </Stack>
        ) : commits.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" height={120} spacing={0.5}>
            <HistoryRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              Nessun commit ancora
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            {commits.map((commit, idx) => (
              <CommitRow
                key={commit.commit_id}
                commit={commit}
                isHead={commit.commit_id === headRef?.commit_id}
                isSelected={selectedCommitId === commit.commit_id}
                onSelect={() => setSelectedCommitId(prev => prev === commit.commit_id ? null : commit.commit_id)}
                onCheckout={handleCheckout}
                onRestore={handleRestore}
                onStatusChange={handleStatusChange}
                loading={actionLoading}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* Footer: stats */}
      <Divider />
      <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
        <Typography variant="caption" color="text.disabled" fontFamily="monospace">
          {commits.length} commit · {branches.length} branch
        </Typography>
      </Box>
    </Drawer>
  );
}
