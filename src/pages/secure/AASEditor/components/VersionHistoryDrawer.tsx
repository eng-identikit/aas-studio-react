import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  CloseRounded,
  CompareArrowsRounded,
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
import { useCustomSnackbar } from '@/context/SnackbarContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAWER_WIDTH = 380;

const STATUS_COLOR: Record<CommitStatus, 'success' | 'warning' | 'default'> = {
  Active: 'success',
  Draft: 'warning',
  Deprecated: 'default',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortHash(hash: string) { return hash.slice(0, 7); }

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'it' ? 'it-IT' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── CommitRow ─────────────────────────────────────────────────────────────────

interface CommitRowProps {
  commit: AASCommit;
  isHead: boolean;
  currentBranch: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onCheckout: (commitId: number) => void;
  onRestore: (commitId: number) => void;
  onStatusChange: (commitId: number, status: CommitStatus) => void;
  loading: boolean;
}

function CommitRow({
  commit, isHead, currentBranch, isSelected,
  onSelect, onCheckout, onRestore, onStatusChange, loading,
}: CommitRowProps) {
  const { t, i18n } = useTranslation();
  return (
    <Box
      onClick={onSelect}
      sx={{
        px: 1.5, py: 1.25, cursor: 'pointer', borderRadius: 1, border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'rgba(99,102,241,.07)' : 'background.paper',
        '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(99,102,241,.04)' },
        transition: 'all .15s',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
        <Typography variant="caption" fontFamily="monospace" color="primary.main" fontWeight={700}>
          {shortHash(commit.commit_hash)}
        </Typography>
        {isHead && (
          <Chip label={currentBranch ? `HEAD → ${currentBranch}` : 'HEAD'} size="small" color="primary"
            sx={{ height: 16, fontSize: 9, fontFamily: 'monospace' }} />
        )}
        <Box flex={1} />
        <Chip label={commit.status} size="small" color={STATUS_COLOR[commit.status]}
          variant="outlined" sx={{ height: 16, fontSize: 9 }} />
      </Stack>

      <Typography variant="body2" fontWeight={500} noWrap sx={{ mb: 0.25 }}>
        {commit.message}
      </Typography>
      <Typography variant="caption" color="text.disabled" fontFamily="monospace">
        v{commit.version} rev {commit.revision} · {fmtDate(commit.createdAt, i18n.language)}
      </Typography>

      <Collapse in={isSelected}>
        <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" useFlexGap>
          <Tooltip title={t('history.checkoutTooltip')}>
            <Button size="small" variant="outlined"
              startIcon={<HistoryRounded sx={{ fontSize: 13 }} />}
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); onCheckout(commit.commit_id); }}
              sx={{ fontSize: 10, py: 0.25 }}>
              {t('history.checkout')}
            </Button>
          </Tooltip>
          <Tooltip title={t('history.restoreTooltip')}>
            <Button size="small" variant="outlined" color="warning"
              startIcon={<RestoreRounded sx={{ fontSize: 13 }} />}
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); onRestore(commit.commit_id); }}
              sx={{ fontSize: 10, py: 0.25 }}>
              {t('history.restore')}
            </Button>
          </Tooltip>
          {commit.status !== 'Active' && (
            <Tooltip title={t('history.setActiveTooltip')}>
              <Button size="small" variant="outlined" color="success"
                startIcon={<CheckCircleOutlineRounded sx={{ fontSize: 13 }} />}
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); onStatusChange(commit.commit_id, 'Active'); }}
                sx={{ fontSize: 10, py: 0.25 }}>
                {t('history.setActive')}
              </Button>
            </Tooltip>
          )}
        </Stack>

        {commit.diffs && commit.diffs.length > 0 && (
          <Box mt={1} pl={0.5}>
            {commit.diffs.map((d) => (
              <Stack key={d.diff_id} direction="row" alignItems="center" spacing={0.5} py={0.15}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  bgcolor: d.change_type === 'added' ? 'success.main' : d.change_type === 'removed' ? 'error.main' : 'warning.main',
                }} />
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
  onAfterCommit?: () => void;
  onOpenCommitDialog: () => void;
}

export default function VersionHistoryDrawer({
  open, onClose, documentId,
  onCheckoutContent, onAfterCommit, onOpenCommitDialog,
}: VersionHistoryDrawerProps) {
  const { t } = useTranslation();
  const versioning = useAASVersioning();
  const { showSnackbar } = useCustomSnackbar();

  const [commits, setCommits] = useState<AASCommit[]>([]);
  const [refs, setRefs] = useState<AASRef[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>('HEAD');
  const [selectedCommitId, setSelectedCommitId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New branch form only (commit goes through CommitDialog in parent)
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
      if (logRes.status === 'Success') setCommits(logRes.data.commits ?? []);
      else setError(logRes.message);
      if (refsRes.status === 'Success') setRefs(refsRes.data.refs ?? []);
      else setError(refsRes.message);
    } catch {
      setError(t('history.loadError'));
    } finally {
      setLoading(false);
    }
  }, [documentId, selectedRef, t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && documentId) loadData();
  }, [open, documentId, loadData]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleCheckout = async (commitId: number) => {
    if (!documentId) return;
    setActionLoading(true);
    try {
      const res = await versioning.checkout(documentId, { commit_id: commitId });
      if (res.status === 'Success' && res.data?.content) {
        onCheckoutContent(res.data.content);
        showSnackbar(t('history.snapshotLoaded'), 'success');
      } else {
        const msg = res.message || t('history.checkoutFailed');
        setError(msg);
        showSnackbar(msg, 'error');
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
      if (res.status === 'Success') {
        await loadData();
        onAfterCommit?.();
        showSnackbar(t('history.restored'), 'success');
      } else {
        const msg = res.message || t('history.restoreFailed');
        setError(msg);
        showSnackbar(msg, 'error');
      }
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
      else setError(res.message || t('history.statusChangeError'));
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
        setError(res.message || t('history.branchError'));
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
      if (res.status === 'Success') { await loadData(); onAfterCommit?.(); }
      else setError(res.message || t('history.switchError'));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────

  const headRef = refs.find(r => r.ref_name === 'HEAD');
  // All refs except HEAD — deduplicate by commit hash to avoid showing
  // branch + HEAD with identical hash side-by-side
  const headCommitId = headRef?.commit_id ?? null;
  const branches = refs.filter(r => r.ref_name !== 'HEAD');
  // Which branch name coincides with HEAD right now (for the HEAD chip label)
  const headBranchName = branches.find(b => b.commit_id === headCommitId)?.ref_name ?? null;

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
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <HistoryRounded sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight={700} flex={1}>{t('history.title')}</Typography>
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
                {t('history.allCommits')}
              </MenuItem>
              <MenuItem value="HEAD" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                HEAD{headBranchName ? ` → ${headBranchName}` : ''}{headRef?.commit ? ` (${shortHash(headRef.commit.commit_hash)})` : ''}
              </MenuItem>
              {branches.map(r => (
                <MenuItem key={r.ref_name} value={r.ref_name} sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                  {r.ref_name}{r.commit ? ` (${shortHash(r.commit.commit_hash)})` : ''}
                  {r.commit_id === headCommitId ? ' ← HEAD' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedRef !== 'HEAD' && selectedRef !== 'ALL' && (
            <Tooltip title={t('history.moveHead', { ref: selectedRef })}>
              <IconButton size="small" onClick={() => handleSwitchBranch(selectedRef)} disabled={actionLoading}>
                <CallMergeRounded sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Action buttons */}
      <Stack direction="row" spacing={1}
        sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tooltip title={t('history.commitTooltip')}>
          <Button
            size="small" variant="outlined"
            startIcon={<SaveRounded sx={{ fontSize: 13 }} />}
            onClick={onOpenCommitDialog}
            sx={{ fontSize: 10 }}
          >
            {t('history.commit')}
          </Button>
        </Tooltip>
        <Button
          size="small" variant="outlined"
          startIcon={<AddRounded sx={{ fontSize: 13 }} />}
          onClick={() => setShowBranchForm(v => !v)}
          disabled={!documentId}
          sx={{ fontSize: 10 }}
        >
          {t('history.branch')}
        </Button>
        <Box flex={1} />
        <Tooltip title={t('history.compareTooltip')}>
          <span>
            <IconButton size="small" disabled>
              <CompareArrowsRounded sx={{ fontSize: 15 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Branch form */}
      <Collapse in={showBranchForm}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(99,102,241,.04)' }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {t('history.createBranchFrom')}
          </Typography>
          <TextField
            size="small" fullWidth
            placeholder={t('history.branchPlaceholder')}
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: 11 } } }}
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained"
              disabled={!branchName.trim() || actionLoading}
              onClick={handleCreateBranch} sx={{ fontSize: 10 }}>
              {t('common.buttons.create')}
            </Button>
            <Button size="small" onClick={() => setShowBranchForm(false)} sx={{ fontSize: 10 }}>
              {t('common.buttons.cancel')}
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
        ) : !documentId ? (
          <Stack alignItems="center" justifyContent="center" height={120} spacing={1} px={2}>
            <HistoryRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" textAlign="center">
              {t('history.noDocument')}
            </Typography>
          </Stack>
        ) : commits.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" height={120} spacing={0.5}>
            <HistoryRounded sx={{ fontSize: 32, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">{t('history.noCommits')}</Typography>
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            {commits.map((commit) => (
              <CommitRow
                key={commit.commit_id}
                commit={commit}
                isHead={commit.commit_id === headRef?.commit_id}
                currentBranch={headBranchName}
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

      <Divider />
      <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
        <Typography variant="caption" color="text.disabled" fontFamily="monospace">
          {t('history.footer', { commits: commits.length, branches: branches.length })}
        </Typography>
      </Box>
    </Drawer>
  );
}
