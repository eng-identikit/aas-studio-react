import { useEffect, useMemo, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBackRounded,
  ArticleOutlined,
  CloseRounded,
  CompareArrowsRounded,
  ErrorOutlineRounded,
  ExpandMoreRounded,
  FolderOutlined,
  FolderOpenOutlined,
  RestoreRounded,
  UnfoldMoreRounded,
} from '@mui/icons-material';

import { useAASVersioning } from '@/hooks/useAASVersioning';
import { useCustomSnackbar } from '@/context/SnackbarContext';
import type { SubmodelTemplate } from '@/context/AASContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CurrentContent {
  idShort: string;
  assetId: string;
  description: string;
  submodels: SubmodelTemplate[];
}

type FileStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffFile {
  key: string;
  label: string;
  status: FileStatus;
  oldText: string;
  newText: string;
  // Raw values behind the two sides, used to apply per-file restores.
  oldVal?: any;
  newVal?: any;
}

interface DiffGroup {
  key: string;
  label: string;
  status: FileStatus;
  files: DiffFile[];
  oldSm?: SubmodelTemplate;
  newSm?: SubmodelTemplate;
  oldIndex?: number;
}

interface CommitDiffPanelProps {
  onBack: () => void;
  documentId: number | null;
  commitId: number | null;
  commitLabel: string; // e.g. "v1.2 rev A"
  current: CurrentContent;
  /** Called after a per-file restore commit succeeds, so the parent can refresh models. */
  onRestored?: () => void;
}

// ── Diff model builders ───────────────────────────────────────────────────────

const fmt = (v: unknown) => (v === undefined ? '' : JSON.stringify(v, null, 2));

function statusOf(oldText: string, newText: string): FileStatus {
  if (!oldText && newText) return 'added';
  if (oldText && !newText) return 'removed';
  return oldText === newText ? 'unchanged' : 'modified';
}

// Pair items of two lists by a key (idShort/id); duplicates get an index suffix
// so nothing is silently dropped.
function pairBy<T>(oldList: T[], newList: T[], keyOf: (x: T, i: number) => string) {
  const seen = new Map<string, number>();
  const uniq = (k: string) => {
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n === 0 ? k : `${k} (${n + 1})`;
  };
  const oldMap = new Map(oldList.map((x, i) => [uniq(keyOf(x, i)), x] as const));
  seen.clear();
  const newMap = new Map(newList.map((x, i) => [uniq(keyOf(x, i)), x] as const));
  seen.clear();
  const keys = [...new Set([...oldMap.keys(), ...newMap.keys()])];
  return keys.map(k => ({ key: k, oldItem: oldMap.get(k), newItem: newMap.get(k) }));
}

function submodelMeta(sm: SubmodelTemplate | undefined) {
  if (!sm) return undefined;
  const { id, idShort, semanticId, description, category } = sm;
  return { id, idShort, semanticId, description, category };
}

// old = commit snapshot, new = current working version (GitLab convention:
// red is what the current version dropped, green is what it introduced).
function buildDiffGroups(oldContent: any, current: CurrentContent, metaLabel: string, propsLabel: string): DiffGroup[] {
  const groups: DiffGroup[] = [];

  const oldMeta = oldContent
    ? { idShort: oldContent.idShort, assetId: oldContent.assetId, description: oldContent.description }
    : undefined;
  const newMeta = { idShort: current.idShort, assetId: current.assetId, description: current.description };
  const metaFile: DiffFile = {
    key: '__meta__',
    label: metaLabel,
    status: statusOf(fmt(oldMeta), fmt(newMeta)),
    oldText: fmt(oldMeta),
    newText: fmt(newMeta),
    oldVal: oldMeta,
    newVal: newMeta,
  };
  groups.push({ key: '__meta__', label: metaLabel, status: metaFile.status, files: [metaFile] });

  const oldSms: SubmodelTemplate[] = Array.isArray(oldContent?.submodels) ? oldContent.submodels : [];
  const newSms: SubmodelTemplate[] = current.submodels ?? [];

  for (const { key, oldItem, newItem } of pairBy(oldSms, newSms, (sm, i) => sm.idShort || sm.id || `#${i}`)) {
    const files: DiffFile[] = [];

    const propsFile: DiffFile = {
      key: `${key}/__props__`,
      label: propsLabel,
      status: statusOf(fmt(submodelMeta(oldItem)), fmt(submodelMeta(newItem))),
      oldText: fmt(submodelMeta(oldItem)),
      newText: fmt(submodelMeta(newItem)),
    };
    files.push(propsFile);

    const oldEls = oldItem?.elements ?? [];
    const newEls = newItem?.elements ?? [];
    for (const pair of pairBy(oldEls, newEls, (el, i) => el.idShort || `#${i}`)) {
      files.push({
        key: `${key}/${pair.key}`,
        label: pair.key,
        status: statusOf(fmt(pair.oldItem), fmt(pair.newItem)),
        oldText: fmt(pair.oldItem),
        newText: fmt(pair.newItem),
        oldVal: pair.oldItem,
        newVal: pair.newItem,
      });
    }

    const groupStatus: FileStatus =
      !oldItem ? 'added'
      : !newItem ? 'removed'
      : files.some(f => f.status !== 'unchanged') ? 'modified' : 'unchanged';

    groups.push({
      key, label: key, status: groupStatus, files,
      oldSm: oldItem, newSm: newItem,
      oldIndex: oldItem ? oldSms.indexOf(oldItem) : undefined,
    });
  }

  return groups;
}

// Build the content for a restore commit: the current working content with the
// selected files reverted to the commit snapshot (GitLab-style partial revert).
// Matching is by object identity — oldVal/newVal reference the same objects that
// buildDiffGroups received.
function applyRestore(current: CurrentContent, groups: DiffGroup[], selected: Set<string>) {
  const metaOld = groups.find(g => g.key === '__meta__')?.files[0]?.oldVal;
  const useOldMeta = selected.has('__meta__') && metaOld;
  const out = {
    idShort: useOldMeta ? metaOld.idShort : current.idShort,
    assetId: useOldMeta ? metaOld.assetId : current.assetId,
    description: useOldMeta ? (metaOld.description ?? '') : current.description,
    submodels: [] as SubmodelTemplate[],
  };

  const byNewSm = new Map(groups.filter(g => g.newSm).map(g => [g.newSm, g] as const));

  for (const sm of current.submodels ?? []) {
    const g = byNewSm.get(sm);
    if (!g) { out.submodels.push(sm); continue; }
    const propsSelected = selected.has(`${g.key}/__props__`);
    // Submodel that only exists in the current version: restoring its
    // properties means the whole submodel goes away.
    if (propsSelected && !g.oldSm) continue;
    let next: SubmodelTemplate = { ...sm, elements: [...(sm.elements ?? [])] };
    if (propsSelected && g.oldSm) next = { ...next, ...submodelMeta(g.oldSm) };
    for (const f of g.files) {
      if (f.key.endsWith('/__props__') || !selected.has(f.key)) continue;
      if (f.oldVal && f.newVal) {
        const i = next.elements.findIndex(e => e === f.newVal);
        if (i >= 0) next.elements[i] = f.oldVal;
      } else if (f.oldVal) {
        next.elements.push(f.oldVal);
      } else if (f.newVal) {
        next.elements = next.elements.filter(e => e !== f.newVal);
      }
    }
    out.submodels.push(next);
  }

  // Submodels removed in the current version: re-create them (old metadata plus
  // the selected elements) when any of their files is selected.
  for (const g of groups) {
    if (g.key === '__meta__' || g.newSm || !g.oldSm) continue;
    const wanted = g.files.filter(f => selected.has(f.key));
    if (!wanted.length) continue;
    const restored: SubmodelTemplate = { ...g.oldSm, elements: [] };
    for (const f of wanted) {
      if (!f.key.endsWith('/__props__') && f.oldVal) restored.elements.push(f.oldVal);
    }
    const at = Math.min(g.oldIndex ?? out.submodels.length, out.submodels.length);
    out.submodels.splice(at, 0, restored);
  }

  return out;
}

// ── Line diff (LCS) ───────────────────────────────────────────────────────────

interface DiffRow {
  type: 'ctx' | 'add' | 'del';
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

function diffRows(oldText: string, newText: string): DiffRow[] {
  const a = oldText ? oldText.split('\n') : [];
  const b = newText ? newText.split('\n') : [];

  // Trim common prefix/suffix so the DP table stays small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const rows: DiffRow[] = [];
  let oldNo = 1, newNo = 1;
  for (let i = 0; i < start; i++) rows.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: a[i] });

  if (midA.length * midB.length > 4_000_000) {
    // Degenerate guard for huge files: plain remove-all/add-all.
    for (const line of midA) rows.push({ type: 'del', oldNo: oldNo++, newNo: null, text: line });
    for (const line of midB) rows.push({ type: 'add', oldNo: null, newNo: newNo++, text: line });
  } else if (midA.length || midB.length) {
    const n = midA.length, m = midB.length;
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        rows.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: midA[i] }); i++; j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        rows.push({ type: 'del', oldNo: oldNo++, newNo: null, text: midA[i] }); i++;
      } else {
        rows.push({ type: 'add', oldNo: null, newNo: newNo++, text: midB[j] }); j++;
      }
    }
    while (i < n) { rows.push({ type: 'del', oldNo: oldNo++, newNo: null, text: midA[i] }); i++; }
    while (j < m) { rows.push({ type: 'add', oldNo: null, newNo: newNo++, text: midB[j] }); j++; }
  }

  for (let i = endA; i < a.length; i++) rows.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: a[i] });
  return rows;
}

// Fold long unchanged runs (GitLab-style “expand” separators).
const CTX_KEEP = 4;

type RenderBlock =
  | { kind: 'rows'; rows: DiffRow[] }
  | { kind: 'fold'; rows: DiffRow[] };

function foldRows(rows: DiffRow[]): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  let buf: DiffRow[] = [];
  const flush = () => { if (buf.length) { blocks.push({ kind: 'rows', rows: buf }); buf = []; } };

  let i = 0;
  while (i < rows.length) {
    if (rows[i].type !== 'ctx') { buf.push(rows[i]); i++; continue; }
    let j = i;
    while (j < rows.length && rows[j].type === 'ctx') j++;
    const run = rows.slice(i, j);
    const isFirst = i === 0, isLast = j === rows.length;
    const keepBefore = isFirst ? 0 : CTX_KEEP;
    const keepAfter = isLast ? 0 : CTX_KEEP;
    if (run.length > keepBefore + keepAfter + 3) {
      buf.push(...run.slice(0, keepBefore));
      flush();
      blocks.push({ kind: 'fold', rows: run.slice(keepBefore, run.length - keepAfter) });
      buf.push(...(keepAfter ? run.slice(run.length - keepAfter) : []));
    } else {
      buf.push(...run);
    }
    i = j;
  }
  flush();
  return blocks;
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

const STATUS_META: Record<FileStatus, { letter: string; color: string; bg: string }> = {
  added:     { letter: 'A', color: '#10b981', bg: 'rgba(16,185,129,.12)' },
  modified:  { letter: 'M', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
  removed:   { letter: 'D', color: '#f05252', bg: 'rgba(240,82,82,.12)' },
  unchanged: { letter: '·', color: '#9ca6b0', bg: 'transparent' },
};

function StatusBadge({ status, title }: { status: FileStatus; title: string }) {
  const meta = STATUS_META[status];
  return (
    <Tooltip title={title}>
      <Box sx={{
        width: 16, height: 16, borderRadius: 0.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: meta.bg, color: meta.color, fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
      }}>
        {meta.letter}
      </Box>
    </Tooltip>
  );
}

const ROW_BG: Record<DiffRow['type'], string> = {
  ctx: 'transparent',
  add: 'rgba(16,185,129,.10)',
  del: 'rgba(240,82,82,.10)',
};
const GUTTER_BG: Record<DiffRow['type'], string> = {
  ctx: 'transparent',
  add: 'rgba(16,185,129,.16)',
  del: 'rgba(240,82,82,.16)',
};
const ROW_SIGN: Record<DiffRow['type'], string> = { ctx: ' ', add: '+', del: '-' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommitDiffPanel({
  onBack, documentId, commitId, commitLabel, current, onRestored,
}: CommitDiffPanelProps) {
  const { t } = useTranslation();
  const { checkout, commitSubmodel } = useAASVersioning();
  const { showSnackbar } = useCustomSnackbar();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldContent, setOldContent] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set());
  const [restoreSel, setRestoreSel] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!documentId || !commitId) return;
    setLoading(true);
    setError(null);
    setOldContent(null);
    setSelectedKey(null);
    setRestoreSel(new Set());
    setExpandedFolds(new Set());
    checkout(documentId, { commit_id: commitId })
      .then(res => {
        if (res.status === 'Success') setOldContent(res.data?.content ?? {});
        else setError(res.message || t('lifecycle.diff.loadError'));
      })
      .catch(() => setError(t('lifecycle.diff.loadError')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, commitId]);

  const groups = useMemo(
    () => (oldContent !== null
      ? buildDiffGroups(oldContent, current, t('lifecycle.diff.metaFile'), t('lifecycle.diff.submodelProps'))
      : []),
    [oldContent, current, t],
  );

  const changedFiles = useMemo(
    () => groups.flatMap(g => g.files).filter(f => f.status !== 'unchanged'),
    [groups],
  );

  // Auto-select the first changed file once the snapshot arrives.
  useEffect(() => {
    if (!selectedKey && changedFiles.length > 0) setSelectedKey(changedFiles[0].key);
  }, [changedFiles, selectedKey]);

  const selectedFile = groups.flatMap(g => g.files).find(f => f.key === selectedKey) ?? null;

  const rows = useMemo(
    () => (selectedFile ? diffRows(selectedFile.oldText, selectedFile.newText) : []),
    [selectedFile],
  );
  const blocks = useMemo(() => foldRows(rows), [rows]);
  const adds = rows.filter(r => r.type === 'add').length;
  const dels = rows.filter(r => r.type === 'del').length;

  useEffect(() => { setExpandedFolds(new Set()); }, [selectedKey]);

  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // ── Per-file restore (GitLab-style partial revert onto a new Draft) ─────────

  const toggleRestore = (keys: string[], on: boolean) =>
    setRestoreSel(prev => {
      const next = new Set(prev);
      keys.forEach(k => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const allSelected = changedFiles.length > 0 && changedFiles.every(f => restoreSel.has(f.key));
  const someSelected = changedFiles.some(f => restoreSel.has(f.key));

  const openRestoreConfirm = () => {
    setRestoreMsg(t('lifecycle.diff.restoreDefaultMsg', { count: restoreSel.size, commit: commitLabel }));
    setConfirmOpen(true);
  };

  const handleRestore = async () => {
    if (!documentId || restoreSel.size === 0) return;
    setRestoring(true);
    try {
      const content = applyRestore(current, groups, restoreSel);
      const res = await commitSubmodel(documentId, {
        message: restoreMsg.trim(),
        content,
        status: 'Draft',
      });
      if (res.status === 'Success') {
        showSnackbar(t('lifecycle.diff.restoreSuccess', { version: res.data?.commit?.version ?? '' }), 'success');
        setRestoreSel(new Set());
        setConfirmOpen(false);
        onRestored?.();
      } else {
        showSnackbar(res.message || t('lifecycle.diff.restoreError'), 'error');
      }
    } catch (err: any) {
      showSnackbar(err?.message || t('lifecycle.diff.restoreError'), 'error');
    } finally {
      setRestoring(false);
    }
  };

  const statusTitle = (s: FileStatus) =>
    s === 'added' ? t('dashboard.change.added')
    : s === 'removed' ? t('dashboard.change.removed')
    : s === 'modified' ? t('dashboard.change.modified')
    : t('lifecycle.diff.unchanged');

  const renderRow = (row: DiffRow, key: string | number) => (
    <Box key={key} sx={{ display: 'flex', bgcolor: ROW_BG[row.type], minWidth: 'fit-content' }}>
      <Box sx={{
        display: 'flex', flexShrink: 0, userSelect: 'none', bgcolor: GUTTER_BG[row.type],
        color: 'text.disabled', fontSize: 10.5, lineHeight: 1.9, fontFamily: 'monospace',
        position: 'sticky', left: 0,
      }}>
        <Box sx={{ width: 40, textAlign: 'right', pr: 0.75 }}>{row.oldNo ?? ''}</Box>
        <Box sx={{ width: 40, textAlign: 'right', pr: 0.75 }}>{row.newNo ?? ''}</Box>
        <Box sx={{ width: 14, textAlign: 'center', fontWeight: 700, color: row.type === 'add' ? '#10b981' : row.type === 'del' ? '#f05252' : 'inherit' }}>
          {ROW_SIGN[row.type]}
        </Box>
      </Box>
      <Typography component="pre" sx={{
        m: 0, px: 0.75, whiteSpace: 'pre', fontFamily: 'monospace',
        fontSize: 11.5, lineHeight: 1.9,
      }}>
        {row.text === '' ? ' ' : row.text}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tooltip title={t('lifecycle.diff.backBtn')}>
          <IconButton size="small" onClick={onBack}>
            <ArrowBackRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <CompareArrowsRounded sx={{ color: 'primary.main' }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2} noWrap>
            {t('lifecycle.diff.title')}
          </Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace" noWrap display="block">
            {t('lifecycle.diff.fromTo', { commit: commitLabel })}
          </Typography>
        </Box>
        <Box flexGrow={1} />
        {restoreSel.size > 0 && (
          <Tooltip title={t('lifecycle.diff.restoreTooltip', { commit: commitLabel })}>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<RestoreRounded sx={{ fontSize: 16 }} />}
              onClick={openRestoreConfirm}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {t('lifecycle.diff.restoreBtn', { count: restoreSel.size })}
            </Button>
          </Tooltip>
        )}
        {!loading && !error && (
          <Chip size="small" variant="outlined" color={changedFiles.length ? 'warning' : 'success'}
            label={changedFiles.length
              ? t('lifecycle.diff.filesChanged', { count: changedFiles.length })
              : t('lifecycle.diff.noChanges')}
            sx={{ fontFamily: 'monospace', fontSize: 10 }} />
        )}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {loading ? (
          <Stack flex={1} alignItems="center" justifyContent="center" spacing={1.5}>
            <CircularProgress size={28} />
            <Typography variant="caption" color="text.secondary">{t('lifecycle.diff.loading')}</Typography>
          </Stack>
        ) : error ? (
          <Stack flex={1} alignItems="center" justifyContent="center" spacing={1}>
            <ErrorOutlineRounded color="error" />
            <Typography variant="body2" color="error.main">{error}</Typography>
          </Stack>
        ) : (
          <>
            {/* ── File tree ── */}
            <Box sx={{
              width: 300, flexShrink: 0, borderRight: 1, borderColor: 'divider',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <Stack direction="row" alignItems="center" spacing={0.5}
                sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Tooltip title={t('lifecycle.diff.selectAllChanged')}>
                  <span>
                    <Checkbox
                      size="small"
                      sx={{ p: 0.25, mr: 0.25 }}
                      disabled={changedFiles.length === 0}
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={(_, on) => toggleRestore(changedFiles.map(f => f.key), on)}
                    />
                  </span>
                </Tooltip>
                <Typography variant="caption" fontWeight={700} color="text.secondary" flex={1}>
                  {t('lifecycle.diff.filesHeader')}
                </Typography>
                <Tooltip title={t('lifecycle.diff.showUnchanged')}>
                  <Switch size="small" checked={showUnchanged} onChange={(_, v) => setShowUnchanged(v)} />
                </Tooltip>
              </Stack>
              <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
                {groups.map(group => {
                  const visibleFiles = group.files.filter(f => showUnchanged || f.status !== 'unchanged');
                  if (!visibleFiles.length && !showUnchanged && group.status === 'unchanged') return null;
                  const collapsed = collapsedGroups.has(group.key);
                  const groupChanged = group.files.filter(f => f.status !== 'unchanged');
                  const groupAll = groupChanged.length > 0 && groupChanged.every(f => restoreSel.has(f.key));
                  const groupSome = groupChanged.some(f => restoreSel.has(f.key));
                  return (
                    <Box key={group.key}>
                      <Stack direction="row" alignItems="center" spacing={0.75}
                        onClick={() => toggleGroup(group.key)}
                        sx={{ px: 1.25, py: 0.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0, visibility: groupChanged.length ? 'visible' : 'hidden' }}
                          checked={groupAll}
                          indeterminate={groupSome && !groupAll}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(_, on) => toggleRestore(groupChanged.map(f => f.key), on)}
                        />
                        <ExpandMoreRounded sx={{
                          fontSize: 15, color: 'text.disabled',
                          transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s',
                        }} />
                        {collapsed
                          ? <FolderOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />
                          : <FolderOpenOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />}
                        <Typography variant="caption" fontFamily="monospace" fontWeight={700} noWrap flex={1}>
                          {group.label}
                        </Typography>
                        <StatusBadge status={group.status} title={statusTitle(group.status)} />
                      </Stack>
                      {!collapsed && visibleFiles.map(file => (
                        <Stack key={file.key} direction="row" alignItems="center" spacing={0.75}
                          onClick={() => setSelectedKey(file.key)}
                          sx={{
                            pl: 4.5, pr: 1.25, py: 0.4, cursor: 'pointer',
                            bgcolor: selectedKey === file.key ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}>
                          <Checkbox
                            size="small"
                            sx={{ p: 0, visibility: file.status !== 'unchanged' ? 'visible' : 'hidden' }}
                            checked={restoreSel.has(file.key)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(_, on) => toggleRestore([file.key], on)}
                          />
                          <ArticleOutlined sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                          <Typography variant="caption" fontFamily="monospace" noWrap flex={1}
                            sx={{ opacity: file.status === 'unchanged' ? 0.55 : 1 }}>
                            {file.label}
                          </Typography>
                          <StatusBadge status={file.status} title={statusTitle(file.status)} />
                        </Stack>
                      ))}
                    </Box>
                  );
                })}
                {changedFiles.length === 0 && (
                  <Typography variant="caption" color="text.disabled" sx={{ px: 1.5, py: 1, display: 'block' }}>
                    {t('lifecycle.diff.noChanges')}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* ── Diff pane ── */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {selectedFile ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={1}
                    sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                    <StatusBadge status={selectedFile.status} title={statusTitle(selectedFile.status)} />
                    <Typography variant="caption" fontFamily="monospace" fontWeight={700} noWrap flex={1}>
                      {selectedFile.key.replace('__meta__', t('lifecycle.diff.metaFile')).replace('__props__', t('lifecycle.diff.submodelProps'))}
                    </Typography>
                    {adds > 0 && (
                      <Typography variant="caption" fontFamily="monospace" fontWeight={700} sx={{ color: '#10b981' }}>
                        +{adds}
                      </Typography>
                    )}
                    {dels > 0 && (
                      <Typography variant="caption" fontFamily="monospace" fontWeight={700} sx={{ color: '#f05252' }}>
                        −{dels}
                      </Typography>
                    )}
                  </Stack>
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {blocks.map((block, bi) => (
                      <Fragment key={bi}>
                        {block.kind === 'rows' || expandedFolds.has(bi) ? (
                          block.rows.map((row, ri) => renderRow(row, `${bi}-${ri}`))
                        ) : (
                          <Stack direction="row" alignItems="center" spacing={0.75}
                            onClick={() => setExpandedFolds(prev => new Set(prev).add(bi))}
                            sx={{
                              px: 1.5, py: 0.4, cursor: 'pointer',
                              bgcolor: 'rgba(99,102,241,.05)',
                              borderTop: '1px dashed', borderBottom: '1px dashed', borderColor: 'divider',
                              '&:hover': { bgcolor: 'rgba(99,102,241,.1)' },
                            }}>
                            <UnfoldMoreRounded sx={{ fontSize: 14, color: 'primary.main' }} />
                            <Typography variant="caption" color="primary.main" fontFamily="monospace">
                              {t('lifecycle.diff.unchangedLines', { count: block.rows.length })}
                            </Typography>
                          </Stack>
                        )}
                      </Fragment>
                    ))}
                  </Box>
                </>
              ) : (
                <Stack flex={1} alignItems="center" justifyContent="center" spacing={1}>
                  <ArticleOutlined sx={{ fontSize: 36, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled">
                    {t('lifecycle.diff.selectFile')}
                  </Typography>
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Restore confirmation: creates a new Draft commit with the selected
          files reverted to the compared snapshot. */}
      <Dialog open={confirmOpen} onClose={() => !restoring && setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreRounded color="primary" />
          {t('lifecycle.diff.restoreTitle')}
          <Box flexGrow={1} />
          <IconButton size="small" onClick={() => setConfirmOpen(false)} disabled={restoring}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('lifecycle.diff.restoreMessage', { count: restoreSel.size, commit: commitLabel })}
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label={t('lifecycle.diff.restoreMsgLabel')}
            value={restoreMsg}
            onChange={(e) => setRestoreMsg(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={restoring}>
            {t('common.buttons.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleRestore}
            disabled={restoring || !restoreMsg.trim()}
            startIcon={restoring ? <CircularProgress size={14} /> : <RestoreRounded />}
          >
            {t('lifecycle.diff.restoreConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
