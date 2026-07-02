import { useState, useCallback, useEffect, KeyboardEvent, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  Tab,
  Tabs,
  TextareaAutosize,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AccountTreeRounded,
  AddRounded,
  CheckCircleRounded,
  CheckRounded,
  CloseRounded,
  CommitRounded,
  DeleteRounded,
  EditRounded,
  ErrorOutlineRounded,
  ExpandMoreRounded,
  FormatListBulletedRounded,
  HistoryRounded,
  MenuOpenRounded,
  TuneRounded,
  WarningAmberRounded,
  EditNoteRounded,
  ArchiveRounded,
  ArrowDropDownRounded,
  Inventory2Rounded,
  WidgetsRounded,
} from '@mui/icons-material';

import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import GraphView from './components/GraphView';

import { useAASContext, XsdValueType, AASModel, SubmodelTemplate, SubmodelElement, SubmodelElementChild, ElementType, validateAAS, ValidationResult } from '@/context/AASContext';
import { useDialogContext } from '@/context/DialogContext';
import { useAASVersioning } from '@/hooks/useAASVersioning';
import { useCustomSnackbar } from '@/context/SnackbarContext';

import ValidationDialog from './dialogs/ValidationDialog';
import AddSubmodelDialog from './dialogs/AddSubmodelDialog';
import AddEntityDialog from './dialogs/AddEntityDialog';
import CommitDialog from './dialogs/CommitDialog';
import ConnectServerDialog from './dialogs/ConnectServerDialog';
import ConfirmExportDialog from './dialogs/ConfirmExportDialog';
import type { CommitStatus } from '@/hooks/useAASVersioning';
import { buildAasEnvironment } from '@/utils/aas-builder';
import { verifyWithLibrary } from '@/utils/aas-validation';
import { mapElement } from '@/utils/aas-mapper';

// ── Types ─────────────────────────────────────────────────────────────────────
type EditorView = 'list' | 'graph';

// ═══════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════

const XSD_TYPES: XsdValueType[] = ['xs:string', 'xs:int', 'xs:double', 'xs:float', 'xs:boolean', 'xs:date', 'xs:dateTime', 'xs:long', 'xs:short', 'xs:byte', 'xs:anyURI', 'xs:duration', 'xs:decimal'];

const NO_SUBMODELS: SubmodelTemplate[] = [];

// Make a click handler keyboard-operable on non-button elements (Enter/Space).
const activateOnKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

const isContainerType = (t: ElementType) => t === 'SubmodelElementCollection' || t === 'SubmodelElementList';

// Normalize any MultiLanguageProperty value shape — the mapped Record<lang,text>,
// the raw AAS [{language,text}] array, or a single {language,text} — to a Record.
function normalizeMlp(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(v)) {
    for (const e of v as { language?: unknown; text?: unknown }[]) {
      if (e?.language != null) out[String(e.language)] = String(e.text ?? '');
    }
  } else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('language' in o && 'text' in o) {
      out[String(o.language)] = String(o.text ?? '');
    } else {
      for (const [k, val] of Object.entries(o)) if (typeof val === 'string') out[k] = val;
    }
  }
  return out;
}

// Short single-line preview of a node's value for the read-only tree row.
function valuePreview(node: SubmodelElement | SubmodelElementChild): string {
  if (node.type === 'Property') return typeof node.value === 'string' ? node.value : '';
  if (node.type === 'MultiLanguageProperty') {
    if (typeof node.value === 'string') return node.value;
    const r = normalizeMlp(node.value);
    return r.en || r.it || Object.values(r)[0] || '';
  }
  if (isContainerType(node.type)) {
    const n = node.children?.length ?? 0;
    return `${n} ${n === 1 ? 'elemento' : 'elementi'}`;
  }
  return '';
}

// Walk the child-index chain to the addressed node: path[0] indexes the
// submodel's top-level elements, the rest index nested children.
function nodeAt(elements: SubmodelElement[], path: number[]): SubmodelElement | SubmodelElementChild | null {
  let node: SubmodelElement | SubmodelElementChild | undefined = elements[path[0]];
  for (let i = 1; i < path.length && node; i++) node = node.children?.[path[i]];
  return node ?? null;
}

// One selectable row in the element tree. Recurses for container children.
interface ElementNodeProps {
  smId: string;
  node: SubmodelElement | SubmodelElementChild;
  path: number[];
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedKey: string | null;
  onSelect: (path: number[]) => void;
  issues: (idShort: string) => { err: number; warn: number };
}

function ElementNode({ smId, node, path, depth, expanded, onToggle, selectedKey, onSelect, issues }: ElementNodeProps) {
  const isContainer = isContainerType(node.type);
  const key = `${smId}:${path.join('.')}`;
  const open = expanded.has(key);
  const selected = selectedKey === key;
  const { err, warn } = issues(node.idShort);
  const dotColor = isContainer ? 'warning.main' : node.type === 'Operation' ? 'info.main' : 'primary.main';
  const typeLabel = node.type === 'SubmodelElementCollection' ? 'Coll' : node.type === 'SubmodelElementList' ? 'List' : node.type;
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        role="button"
        tabIndex={0}
        aria-selected={selected}
        onClick={() => (isContainer ? onToggle(key) : onSelect(path))}
        onKeyDown={activateOnKey(() => (isContainer ? onToggle(key) : onSelect(path)))}
        sx={(theme) => ({
          pl: 1.5 + depth * 2,
          pr: 1.5,
          py: 0.6,
          minHeight: 38,
          cursor: 'pointer',
          bgcolor: selected
            ? 'action.selected'
            : err > 0
              ? alpha(theme.palette.error.main, 0.06)
              : warn > 0
                ? alpha(theme.palette.warning.main, 0.06)
                : 'transparent',
          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
        })}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
        <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap sx={{ flexShrink: 0, maxWidth: '45%' }}>
          {node.idShort || '—'}
        </Typography>
        {node.required && (
          <Typography variant="caption" color="error.main" fontWeight={700} sx={{ fontSize: 9, flexShrink: 0 }}>REQ</Typography>
        )}
        <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {valuePreview(node)}
        </Typography>
        <Typography variant="caption" color="text.disabled" fontFamily="monospace" noWrap sx={{ flexShrink: 0 }}>
          {typeLabel}
        </Typography>
        {isContainer ? (
          <>
            <Tooltip title="Modifica" arrow>
              <IconButton
                size="small"
                aria-label="Modifica"
                onClick={(e) => { e.stopPropagation(); onSelect(path); }}
                sx={{ p: 0.25, flexShrink: 0, color: selected ? 'primary.main' : 'text.secondary' }}
              >
                <EditRounded sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              aria-label={open ? 'Comprimi' : 'Espandi'}
              onClick={(e) => { e.stopPropagation(); onToggle(key); }}
              sx={{ p: 0.25, flexShrink: 0 }}
            >
              <ExpandMoreRounded sx={{ fontSize: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'text.secondary' }} />
            </IconButton>
          </>
        ) : (
          <Box sx={{ width: 24, flexShrink: 0 }} />
        )}
      </Stack>
      {isContainer && (
        <Collapse in={open}>
          {node.children && node.children.length > 0 ? (
            node.children.map((ch, ci) => (
              <ElementNode
                key={ci}
                smId={smId}
                node={ch}
                path={[...path, ci]}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedKey={selectedKey}
                onSelect={onSelect}
                issues={issues}
              />
            ))
          ) : (
            <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ pl: 1.5 + (depth + 1) * 2, py: 0.5, display: 'block' }}>vuoto</Typography>
          )}
        </Collapse>
      )}
    </Box>
  );
}

// Labelled field wrapper used throughout the element inspector.
function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>{label}</FormLabel>
      {children}
    </Box>
  );
}

export default function AASEditor() {
  const {
    selectedModelId, setSelectedModelId,
    availableModels,
    currentModel, currentVersion,
    createModel,
    deleteModel,
    updateCurrentModel,
    updateVersionStatus,
    addSubmodel, removeSubmodel, updateSubmodel, updateElement, updateChild,
    importAas, setSubmodels, refreshModels
  } = useAASContext();

  const submodels = currentModel?.submodels ?? NO_SUBMODELS;
  const aasIdShort = currentModel?.idShort ?? '';
  const aasAssetId = currentModel?.assetId ?? '';
  const aasDescription = currentModel?.description ?? '';

  const { setHandlers } = useDialogContext();
  const { createDocument, commitSubmodel } = useAASVersioning();
  const { showSnackbar } = useCustomSnackbar();

  const [editorView, setEditorView] = useState<EditorView>('list');
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [activeSmId, setActiveSmId] = useState<string>(submodels[0]?.id ?? '');
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [editActiveSm, setEditActiveSm] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [initialValidationData, setInitialValidationData] = useState<Record<string, unknown> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submodelToDelete, setSubmodelToDelete] = useState<SubmodelTemplate | null>(null);
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationExpanded, setValidationExpanded] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [aasDetailsAnchor, setAasDetailsAnchor] = useState<null | HTMLElement>(null);

  // Reset per-model view state when switching models.
  useEffect(() => {
    setValidationResult(null);
    setValidationExpanded(false);
    setActiveSmId(currentModel?.submodels?.[0]?.id ?? '');
    setSelectedPath(null);
    setEditActiveSm(false);
  }, [selectedModelId]);

  const versionDocumentId = currentModel?.documentId ?? null;

  const handleValidateInline = useCallback(() => {
    // Authoring-intent checks (required, valueType, idShort format, duplicates)
    // plus the official IDTA metamodel verification from aas-core.
    const custom = validateAAS({ idShort: aasIdShort, assetId: aasAssetId }, submodels);
    const libErrors = verifyWithLibrary(
      aasIdShort, aasAssetId, aasDescription, currentModel?.assetKind ?? 'Instance', submodels
    );
    const seen = new Set(custom.errors.map(f => `${f.path}|${f.msg}`));
    const errors = [...custom.errors];
    for (const f of libErrors) {
      const key = `${f.path}|${f.msg}`;
      if (!seen.has(key)) { seen.add(key); errors.push(f); }
    }
    const result: ValidationResult = {
      errors, warnings: custom.warnings, infos: custom.infos, valid: errors.length === 0,
    };
    setValidationResult(result);
    setValidationExpanded(errors.length + result.warnings.length > 0);
    if (!result.valid) {
      const firstErr = result.errors
        .map(f => f.path.match(/^SM\[(\d+)\]/)?.[1])
        .find((v): v is string => v !== undefined);
      if (firstErr !== undefined) {
        const sm = submodels[Number(firstErr)];
        if (sm) { setActiveSmId(sm.id); setSelectedPath(null); }
      }
    }
  }, [aasIdShort, aasAssetId, aasDescription, currentModel?.assetKind, submodels]);

  const handleExport = useCallback(() => {
    const env = buildAasEnvironment(aasIdShort, aasAssetId, aasDescription, currentModel?.assetKind ?? 'Instance', submodels);
    const data = JSON.stringify(env, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${aasIdShort || 'aas'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aasIdShort, aasAssetId, aasDescription, currentModel?.assetKind, submodels]);

  // Register secondary menu handlers
  useEffect(() => {
    setHandlers({
      onValidateAAS: handleValidateInline,
      onConnectServer: () => setShowConnectDialog(true),
      onAddSubmodel: () => setShowAddDialog(true),
      onAddEntity: () => setShowAddEntityDialog(true),
      onExportAASX: () => setShowExportDialog(true),
    });
    return () => setHandlers({});
  }, [setHandlers, handleExport, handleValidateInline]);

  // Keyboard accelerators: Ctrl/Cmd+S = commit, Ctrl/Cmd+Enter = validate.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !currentModel) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!isSaving && (currentModel.dirty || !currentModel.documentId)) setShowCommitDialog(true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleValidateInline();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentModel, isSaving, handleValidateInline]);

  const handleSaveToServer = useCallback(async (
    message: string, version: string, revision: string, status: CommitStatus
  ) => {
    setIsSaving(true);
    setShowCommitDialog(false);
    try {
      const content = { submodels, idShort: aasIdShort, assetId: aasAssetId, description: aasDescription };

      if (!currentModel.documentId) {
        const res = await createDocument({
          id_short: aasIdShort,
          aas_id: currentModel.id,
          asset_id: aasAssetId,
          asset_kind: currentModel.assetKind,
          description: aasDescription,
          message,
          version,
          revision,
          content,
        });
        if (res.status !== 'Success') {
          showSnackbar(res.message || 'Errore durante il salvataggio', 'error');
          return;
        }
        const docId = res.data?.document?.document_id;
        if (docId) {
          // Adopt the server-normalized snapshot (with documentId) for this model,
          // replacing the local working copy now that it is persisted.
          await refreshModels(currentModel.id);
          showSnackbar('AAS salvato sul server', 'success');
        }
      } else {
        const res = await commitSubmodel(currentModel.documentId, {
          message,
          content,
          version,
          revision,
          status,
        });
        if (res.status !== 'Success') {
          showSnackbar(res.message || 'Errore durante il commit', 'error');
          return;
        }
        await refreshModels(currentModel.id);
        showSnackbar('Commit salvato sul server', 'success');
      }
    } catch (err: any) {
      showSnackbar(err?.message || 'Errore durante il salvataggio sul server', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [aasIdShort, aasAssetId, aasDescription, submodels, currentModel, createDocument, commitSubmodel, refreshModels, showSnackbar]);

  // Empty state: no AAS model yet (fresh DB / nothing imported). Placed after
  // ALL hooks so the hook order never changes between renders; the "Nuova
  // entità" menu handler is already registered above, so it works here too.
  if (!currentModel) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Stack alignItems="center" spacing={1.5} sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Inventory2Rounded sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6" fontWeight={600}>Nessun modello AAS</Typography>
          <Typography variant="body2" color="text.secondary">
            Crea un nuovo modello AAS o importa un file JSON standard per iniziare.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => setShowAddEntityDialog(true)}
            sx={{ mt: 1 }}
          >
            Nuovo modello
          </Button>
        </Stack>
        <AddEntityDialog
          open={showAddEntityDialog}
          onClose={() => setShowAddEntityDialog(false)}
          onAdd={createModel}
          onImport={importAas}
        />
      </Box>
    );
  }

  const toggleElement = (key: string) => {
    setExpandedElements(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const stats: [string, number][] = [
    ['Submodels', submodels.length],
    ['Properties', submodels.flatMap(s => s.elements).filter(e => e.type === 'Property').length],
    ['Collections', submodels.flatMap(s => s.elements).filter(e => e.type === 'SubmodelElementCollection').length],
  ];

  // Active submodel (tab) + selected element (inspector target).
  const activeSm = submodels.find(s => s.id === activeSmId) ?? submodels[0] ?? null;
  const selectedNode = activeSm && selectedPath ? nodeAt(activeSm.elements, selectedPath) : null;
  const isTopLevelSel = (selectedPath?.length ?? 0) === 1;
  const selectedMlv = selectedNode ? normalizeMlp(selectedNode.value) : {};

  // Route a field edit to updateElement (top-level) or updateChild (nested).
  const updateSelected = (field: string, value: string | Record<string, string>) => {
    if (!activeSm || !selectedPath) return;
    const [ei, ...rest] = selectedPath;
    if (rest.length === 0) updateElement(activeSm.id, ei, field, value);
    else updateChild(activeSm.id, ei, rest, field, value as string);
  };

  // Error/warning counts for a node in the active submodel, matched by idShort.
  const smIssues = (idShort: string) => {
    if (!activeSm) return { err: 0, warn: 0 };
    const p = `SM[${submodels.indexOf(activeSm)}]`;
    const match = (f: { path: string }) => f.path.startsWith(p) && f.path.includes(`→ ${idShort}`);
    return {
      err: validationResult?.errors.filter(match).length ?? 0,
      warn: validationResult?.warnings.filter(match).length ?? 0,
    };
  };

  return (
    <>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* ── Model rail (replaces the model dropdown) ── */}
        <Box
          component="nav"
          aria-label="Modelli AAS"
          sx={{
            width: railCollapsed ? 56 : 208,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            transition: 'width .2s',
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent={railCollapsed ? 'center' : 'space-between'}
            sx={{ px: railCollapsed ? 0 : 1.5, minHeight: 48, flexShrink: 0 }}
          >
            {!railCollapsed && (
              <Typography variant="overline" color="text.secondary" noWrap>Modelli</Typography>
            )}
            <Tooltip title={railCollapsed ? 'Espandi elenco' : 'Comprimi elenco'} arrow placement="right">
              <IconButton
                size="small"
                onClick={() => setRailCollapsed(v => !v)}
                aria-label={railCollapsed ? 'Espandi elenco modelli' : 'Comprimi elenco modelli'}
              >
                <MenuOpenRounded sx={{ fontSize: 18, transform: railCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: railCollapsed ? 0.5 : 1, pb: 1 }}>
            <Stack spacing={0.25}>
              {availableModels.map(m => {
                const selected = m.id === selectedModelId;
                const name = m.idShort.replace('AAS_', '');
                return (
                  <Tooltip key={m.id} title={railCollapsed ? name : ''} placement="right" arrow disableHoverListener={!railCollapsed}>
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-current={selected}
                      onClick={() => setSelectedModelId(m.id)}
                      onKeyDown={activateOnKey(() => setSelectedModelId(m.id))}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: railCollapsed ? 0 : 1,
                        py: 0.75,
                        justifyContent: railCollapsed ? 'center' : 'flex-start',
                        borderRadius: 1,
                        cursor: 'pointer',
                        color: selected ? 'primary.main' : 'text.primary',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Inventory2Rounded sx={{ fontSize: 18, flexShrink: 0, color: selected ? 'primary.main' : 'text.secondary' }} />
                      {!railCollapsed && (
                        <Typography variant="body2" noWrap fontFamily="monospace" fontWeight={selected ? 600 : 400} sx={{ minWidth: 0 }}>
                          {name}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ p: railCollapsed ? 0.5 : 1, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            {railCollapsed ? (
              <Tooltip title="Nuovo modello AAS" placement="right" arrow>
                <IconButton size="small" onClick={() => setShowAddEntityDialog(true)} aria-label="Nuovo modello AAS" sx={{ width: '100%' }}>
                  <AddRounded sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button fullWidth size="small" variant="outlined" startIcon={<AddRounded />} onClick={() => setShowAddEntityDialog(true)} sx={{ borderStyle: 'dashed' }}>
                Nuovo modello
              </Button>
            )}
          </Box>
        </Box>

        {/* ── Detail: header + body ── */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header (reclaims the old fixed properties column) */}
          <Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap flexWrap="wrap">
              <Inventory2Rounded sx={{ fontSize: 22, color: 'primary.main', flexShrink: 0 }} />
              <TextField
                variant="standard"
                value={aasIdShort}
                onChange={(e) => updateCurrentModel({ idShort: e.target.value })}
                inputProps={{ 'aria-label': 'idShort AAS', style: { fontFamily: 'monospace', fontWeight: 700, fontSize: 18 } }}
                sx={{ minWidth: 120, maxWidth: 340 }}
              />

              <Tooltip title="Cambia stato del commit corrente" arrow>
                <Chip
                  size="small"
                  label={
                    <Stack direction="row" alignItems="center" spacing={0.4}>
                      <span>{currentVersion.status}</span>
                      <ArrowDropDownRounded sx={{ fontSize: 16, ml: -0.25 }} />
                    </Stack>
                  }
                  color={currentVersion.status === 'Active' ? 'success' : currentVersion.status === 'Draft' ? 'warning' : 'default'}
                  variant="outlined"
                  onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                  sx={{ cursor: 'pointer', pr: 0.5 }}
                />
              </Tooltip>

              <Typography
                variant="caption"
                fontFamily="monospace"
                sx={{ px: 1, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, color: 'text.secondary', userSelect: 'none' }}
              >
                v{currentVersion.version}&nbsp;rev.{currentVersion.revision}
              </Typography>

              {currentModel.dirty ? (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
                  <Typography variant="caption" color="warning.main" fontWeight={600}>Non salvato</Typography>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CheckRounded sx={{ fontSize: 14, color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">Salvato</Typography>
                </Stack>
              )}

              <Box flexGrow={1} />

              <ToggleButtonGroup
                size="small"
                exclusive
                value={editorView}
                onChange={(_, v) => v && setEditorView(v as EditorView)}
              >
                <ToggleButton value="list">
                  <FormatListBulletedRounded sx={{ fontSize: 16, mr: 0.5 }} /> Lista
                </ToggleButton>
                <ToggleButton value="graph">
                  <AccountTreeRounded sx={{ fontSize: 16, mr: 0.5 }} /> Grafo
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="outlined"
                size="small"
                startIcon={<TuneRounded />}
                onClick={(e) => setAasDetailsAnchor(e.currentTarget)}
              >
                Dettagli
              </Button>

              <Button
                variant={showHistory ? 'contained' : 'outlined'}
                size="small"
                startIcon={<HistoryRounded />}
                onClick={() => setShowHistory(v => !v)}
              >
                Cronologia
              </Button>

              <Tooltip title="Salva commit (Ctrl+S)" arrow>
                <span>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CommitRounded />}
                    onClick={() => setShowCommitDialog(true)}
                    disabled={isSaving || (!currentModel.dirty && Boolean(currentModel.documentId))}
                  >
                    Commit
                  </Button>
                </span>
              </Tooltip>

              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteRounded />}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Elimina
              </Button>
            </Stack>

            {/* Metadata row */}
            <Stack direction="row" alignItems="center" spacing={2} useFlexGap flexWrap="wrap" mt={1}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>globalAssetId</Typography>
                <TextField
                  variant="standard"
                  value={aasAssetId}
                  onChange={(e) => updateCurrentModel({ assetId: e.target.value })}
                  inputProps={{ 'aria-label': 'globalAssetId', style: { fontFamily: 'monospace', fontSize: 11 } }}
                  sx={{ minWidth: 220 }}
                />
              </Stack>
              <Chip size="small" variant="outlined" label={currentModel.assetKind} sx={{ fontFamily: 'monospace', fontSize: 10 }} />
              <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
              {stats.map(([k, v]) => (
                <Typography key={k} variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {k}{' '}
                  <Box component="span" sx={{ color: 'primary.main', fontFamily: 'monospace', fontWeight: 600 }}>{v}</Box>
                </Typography>
              ))}
            </Stack>
          </Box>

          {/* Status menu (shared) */}
          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={() => setStatusMenuAnchor(null)}
            transformOrigin={{ horizontal: 'left', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
          >
            <Box sx={{ px: 2, pt: 1.25, pb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.6}>
                Stato commit locale
              </Typography>
            </Box>
            {([
              { status: 'Draft',      icon: <EditNoteRounded fontSize="small" />,      color: 'warning.main', desc: 'In lavorazione, modificabile' },
              { status: 'Active',     icon: <CheckCircleRounded fontSize="small" />,   color: 'success.main', desc: 'Approvato e in uso operativo' },
              { status: 'Deprecated', icon: <ArchiveRounded fontSize="small" />,       color: 'text.secondary', desc: 'Sorpassato da versione più recente' },
            ] as const).map(({ status, icon, color, desc }) => (
              <MenuItem
                key={status}
                selected={currentVersion.status === status}
                onClick={() => { updateVersionStatus(status); setStatusMenuAnchor(null); }}
                sx={{ borderRadius: 1, mx: 0.5, mb: 0.25 }}
              >
                <ListItemIcon sx={{ color }}>{icon}</ListItemIcon>
                <ListItemText
                  primary={status}
                  secondary={desc}
                  primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }}
                  secondaryTypographyProps={{ fontSize: 11 }}
                />
              </MenuItem>
            ))}
          </Menu>

          {/* Dettagli AAS popover (relocates the old fixed properties column) */}
          <Popover
            open={Boolean(aasDetailsAnchor)}
            anchorEl={aasDetailsAnchor}
            onClose={() => setAasDetailsAnchor(null)}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            slotProps={{ paper: { sx: { mt: 0.5, width: 340 } } }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary" display="block" mb={1}>Dettagli AAS</Typography>
              <Stack spacing={1.5}>
                <Box>
                  <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>description</FormLabel>
                  {/* Frame replicating the theme's OutlinedInput so a standalone
                      TextareaAutosize matches the other fields' style. */}
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      padding: '8px 12px',
                      color: (theme.vars || theme).palette.text.primary,
                      borderRadius: `${theme.shape.borderRadius}px`,
                      border: `1px solid ${(theme.vars || theme).palette.divider}`,
                      backgroundColor: (theme.vars || theme).palette.background.default,
                      transition: 'border 120ms ease-in',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      '&:hover': { borderColor: (theme.vars || theme).palette.grey[500] },
                      '&:focus-within': {
                        outline: theme.vars
                          ? `3px solid rgba(${theme.vars.palette.primary.mainChannel} / 0.5)`
                          : `3px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                        borderColor: (theme.vars || theme).palette.primary.light,
                      },
                    })}
                  >
                    <TextareaAutosize
                      aria-label="description"
                      minRows={2}
                      maxRows={6}
                      value={aasDescription}
                      onChange={(e) => updateCurrentModel({ description: e.target.value })}
                      style={{
                        width: '100%',
                        margin: 0,
                        padding: 0,
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        lineHeight: 'inherit',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        background: 'transparent',
                        display: 'block',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Box>
                </Box>
                <Box>
                  <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>assetKind</FormLabel>
                  <TextField
                    value={currentModel.assetKind}
                    size="small"
                    fullWidth
                    inputProps={{ 'aria-label': 'assetKind', readOnly: true, style: { fontFamily: 'monospace', fontSize: 11 } }}
                  />
                </Box>
              </Stack>
            </Box>
          </Popover>

          {/* Body */}
          <Box
            sx={(theme) => ({
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'transparent',
              bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.04) : 'background.default',
              transition: 'all .2s',
              overflow: 'hidden',
            })}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.getData('nt') === 'Submodel') setShowAddDialog(true);
            }}
          >
            {editorView === 'graph' ? (
              <GraphView aasId={aasIdShort} sms={submodels} />
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                {/* Left: submodel tabs + element tree */}
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

                  {/* Submodel tabs (replace the stacked submodel cards) */}
                  {submodels.length > 0 && (
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                      <Tabs
                        value={activeSm ? activeSm.id : false}
                        onChange={(_, v) => { setActiveSmId(v); setSelectedPath(null); setEditActiveSm(false); }}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', py: 0.5 } }}
                      >
                        {submodels.map((sm, idx) => {
                          const p = `SM[${idx}]`;
                          const e = validationResult?.errors.filter(f => f.path.startsWith(p)).length ?? 0;
                          const w = validationResult?.warnings.filter(f => f.path.startsWith(p)).length ?? 0;
                          return (
                            <Tab
                              key={sm.id}
                              value={sm.id}
                              label={
                                <Stack direction="row" alignItems="center" spacing={0.75}>
                                  <WidgetsRounded sx={{ fontSize: 16 }} />
                                  <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>{sm.idShort}</Typography>
                                  <Chip size="small" label={sm.elements?.length ?? 0} sx={{ height: 18, fontSize: 10, fontFamily: 'monospace' }} />
                                  {e > 0 && <ErrorOutlineRounded sx={{ fontSize: 14, color: 'error.main' }} />}
                                  {e === 0 && w > 0 && <WarningAmberRounded sx={{ fontSize: 14, color: 'warning.main' }} />}
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Tabs>
                    </Box>
                  )}

                  {/* Active submodel toolbar */}
                  {activeSm && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap sx={{ flex: 1, minWidth: 0 }}>{activeSm.id}</Typography>
                      <Tooltip title="Modifica identità submodel" arrow>
                        <IconButton size="small" onClick={() => setEditActiveSm(v => !v)} sx={{ color: editActiveSm ? 'primary.main' : 'text.secondary' }}>
                          <EditRounded sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina submodel" arrow>
                        <IconButton size="small" onClick={() => setSubmodelToDelete(activeSm)} sx={{ color: 'text.secondary' }}>
                          <DeleteRounded sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}

                  {/* Scrollable content */}
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

                    {/* Submodel identity edit */}
                    {activeSm && (
                      <Collapse in={editActiveSm}>
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1.25}>
                              <Box sx={{ flex: 1 }}>
                                <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>idShort</FormLabel>
                                <TextField size="small" fullWidth value={activeSm.idShort} onChange={(e) => updateSubmodel(activeSm.id, { idShort: e.target.value })} inputProps={{ 'aria-label': 'Submodel idShort', style: { fontFamily: 'monospace', fontSize: 11 } }} />
                              </Box>
                              <Box sx={{ flex: 2 }}>
                                <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>id (AAS instance IRI)</FormLabel>
                                <TextField size="small" fullWidth value={activeSm.id} onChange={(e) => updateSubmodel(activeSm.id, { id: e.target.value })} inputProps={{ 'aria-label': 'Submodel id (IRI)', style: { fontFamily: 'monospace', fontSize: 11 } }} />
                              </Box>
                            </Stack>
                            <Box>
                              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>semanticId</FormLabel>
                              <TextField size="small" fullWidth value={activeSm.semanticId} onChange={(e) => updateSubmodel(activeSm.id, { semanticId: e.target.value })} inputProps={{ 'aria-label': 'Submodel semanticId', style: { fontFamily: 'monospace', fontSize: 11 } }} />
                            </Box>
                            <Box>
                              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>Descrizione</FormLabel>
                              <TextField size="small" fullWidth value={activeSm.description} onChange={(e) => updateSubmodel(activeSm.id, { description: e.target.value })} inputProps={{ 'aria-label': 'Submodel descrizione' }} />
                            </Box>
                          </Stack>
                        </Box>
                      </Collapse>
                    )}

                    {/* ── Validation summary bar ── */}
                    {validationResult && (
                  <Paper
                    variant="outlined"
                    sx={(theme) => ({
                      m: 2,
                      borderColor: validationResult.valid ? 'success.main' : 'error.main',
                      bgcolor: validationResult.valid
                        ? alpha(theme.palette.success.main, 0.08)
                        : alpha(theme.palette.error.main, 0.08),
                    })}
                  >
                    <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {validationResult.valid
                        ? <CheckRounded sx={{ color: 'success.main', fontSize: 18 }} />
                        : <ErrorOutlineRounded sx={{ color: 'error.main', fontSize: 18 }} />}
                      <Box flex={1}>
                        {validationResult.valid ? (
                          validationResult.warnings.length > 0 ? (
                            <Typography variant="body2" color="warning.main" fontWeight={600}>
                              Conforme agli standard IDTA — {validationResult.warnings.length} {validationResult.warnings.length === 1 ? 'avviso' : 'avvisi'}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="success.main" fontWeight={600}>Modello conforme agli standard IDTA</Typography>
                          )
                        ) : (
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" color="error.main" fontWeight={600}>
                              {validationResult.errors.length} {validationResult.errors.length === 1 ? 'errore' : 'errori'}
                            </Typography>
                            {validationResult.warnings.length > 0 && (
                              <Typography variant="body2" color="warning.main" fontWeight={600}>
                                {validationResult.warnings.length} {validationResult.warnings.length === 1 ? 'avviso' : 'avvisi'}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Box>
                      {(validationResult.errors.length + validationResult.warnings.length) > 0 && (
                        <IconButton size="small" aria-label="Mostra dettagli validazione" onClick={() => setValidationExpanded(e => !e)} sx={{ color: 'text.secondary' }}>
                          <ExpandMoreRounded sx={{ fontSize: 18, transition: 'transform .2s', transform: validationExpanded ? 'rotate(180deg)' : 'none' }} />
                        </IconButton>
                      )}
                      <IconButton size="small" aria-label="Chiudi validazione" onClick={() => setValidationResult(null)} sx={{ color: 'text.secondary' }}>
                        <CloseRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                    <Collapse in={validationExpanded}>
                      <Stack spacing={0.5} sx={{ px: 2, pb: 1.5, pt: 0.5, borderTop: 1, borderColor: 'divider' }}>
                        {[
                          ...validationResult.errors.map(f => ({ ...f, sev: 'error' as const })),
                          ...validationResult.warnings.map(f => ({ ...f, sev: 'warning' as const })),
                        ].map((f, i) => (
                          <Stack key={i} direction="row" alignItems="flex-start" spacing={0.75} sx={{ mt: i === 0 ? 0.5 : 0 }}>
                            {f.sev === 'error'
                              ? <ErrorOutlineRounded sx={{ fontSize: 14, color: 'error.main', flexShrink: 0, mt: '2px' }} />
                              : <WarningAmberRounded sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0, mt: '2px' }} />}
                            <Box>
                              <Typography variant="caption" color={f.sev === 'error' ? 'error.main' : 'warning.main'} fontWeight={600} sx={{ display: 'block' }}>
                                {f.msg}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ display: 'block' }}>
                                {f.path}
                              </Typography>
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </Collapse>
                  </Paper>
                )}

                    {/* Empty states */}
                    {!submodels.length && !dragOver && (
                      <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', minHeight: 200 }} spacing={0.75}>
                        <WidgetsRounded sx={{ fontSize: 40, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={500} color="text.secondary">Trascina un Submodel qui</Typography>
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">oppure usa «Aggiungi Submodel» qui sotto</Typography>
                      </Stack>
                    )}
                    {activeSm && activeSm.elements.length === 0 && (
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary" textAlign="center" display="block" py={3}>
                        Nessun elemento in questo submodel
                      </Typography>
                    )}

                    {/* Element tree — click a row to edit its full spec in the inspector */}
                    {activeSm && activeSm.elements.map((el, ei) => (
                      <ElementNode
                        key={ei}
                        smId={activeSm.id}
                        node={el}
                        path={[ei]}
                        depth={0}
                        expanded={expandedElements}
                        onToggle={toggleElement}
                        selectedKey={selectedPath ? `${activeSm.id}:${selectedPath.join('.')}` : null}
                        onSelect={(p) => setSelectedPath(prev => prev && prev.join('.') === p.join('.') ? null : p)}
                        issues={smIssues}
                      />
                    ))}

                  </Box>{/* end scrollable content */}

                  {/* Fixed footer button */}
                  <Box sx={{ flexShrink: 0, p: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<AddRounded />}
                      onClick={() => setShowAddDialog(true)}
                      sx={{ borderStyle: 'dashed', fontFamily: 'monospace' }}
                    >
                      Aggiungi Submodel
                    </Button>
                  </Box>
                </Box>{/* end left column */}

                {/* Right: element inspector (slides in on element select) */}
                <Collapse
                  orientation="horizontal"
                  in={Boolean(selectedNode)}
                  sx={{ flexShrink: 0, height: '100%', '& .MuiCollapse-wrapperInner': { height: '100%' } }}
                >
                  <Box sx={{ width: 340, height: '100%', borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
                    {selectedNode && (
                      <>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace" noWrap>{selectedNode.idShort || '—'}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{selectedNode.type}</Typography>
                          </Box>
                          <IconButton size="small" onClick={() => setSelectedPath(null)} aria-label="Chiudi dettagli elemento">
                            <CloseRounded sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Stack>
                        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
                          <Stack spacing={2}>
                            <InspectorField label="idShort">
                              <TextField size="small" fullWidth value={selectedNode.idShort} onChange={(e) => updateSelected('idShort', e.target.value)} inputProps={{ 'aria-label': 'idShort', style: { fontFamily: 'monospace', fontSize: 12 } }} />
                            </InspectorField>
                            <InspectorField label="semanticId">
                              <TextField size="small" fullWidth value={selectedNode.semanticId ?? ''} onChange={(e) => updateSelected('semanticId', e.target.value)} inputProps={{ 'aria-label': 'semanticId', style: { fontFamily: 'monospace', fontSize: 12 } }} />
                            </InspectorField>

                            {selectedNode.type === 'Property' && (
                              <>
                                <InspectorField label="valueType">
                                  <Select size="small" fullWidth value={selectedNode.valueType || 'xs:string'} onChange={(e) => updateSelected('valueType', e.target.value)} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                    {XSD_TYPES.map(t => (<MenuItem key={t} value={t} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</MenuItem>))}
                                  </Select>
                                </InspectorField>
                                <InspectorField label="value">
                                  <TextField size="small" fullWidth multiline minRows={1} maxRows={6} value={typeof selectedNode.value === 'string' ? selectedNode.value : ''} onChange={(e) => updateSelected('value', e.target.value)} inputProps={{ 'aria-label': 'value', style: { fontFamily: 'monospace', fontSize: 12 } }} />
                                </InspectorField>
                              </>
                            )}

                            {selectedNode.type === 'MultiLanguageProperty' && (
                              <InspectorField label={isTopLevelSel ? 'value (per lingua)' : 'value'}>
                                {isTopLevelSel ? (
                                  <Stack spacing={1}>
                                    {(['en', 'it', 'de'] as const).map(lang => (
                                      <TextField key={lang} size="small" fullWidth label={lang} value={selectedMlv[lang] || ''} onChange={(e) => updateSelected('value', { ...selectedMlv, [lang]: e.target.value })} inputProps={{ style: { fontSize: 12 } }} />
                                    ))}
                                  </Stack>
                                ) : (
                                  <TextField size="small" fullWidth value={typeof selectedNode.value === 'string' ? selectedNode.value : ''} onChange={(e) => updateSelected('value', e.target.value)} inputProps={{ style: { fontSize: 12 } }} />
                                )}
                              </InspectorField>
                            )}

                            {isContainerType(selectedNode.type) && (
                              <InspectorField label="contenuto">
                                <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                                  {selectedNode.children?.length ?? 0} {(selectedNode.children?.length ?? 0) === 1 ? 'elemento' : 'elementi'}
                                </Typography>
                              </InspectorField>
                            )}

                            <Divider />
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption" color="text.secondary">required</Typography>
                              <Chip size="small" variant="outlined" label={selectedNode.required ? 'Sì' : 'No'} color={selectedNode.required ? 'error' : 'default'} sx={{ fontSize: 10, height: 20 }} />
                            </Stack>
                          </Stack>
                        </Box>
                      </>
                    )}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <ConnectServerDialog open={showConnectDialog} onClose={() => setShowConnectDialog(false)} />

      <ConfirmExportDialog
        open={showExportDialog}
        fileName={`${aasIdShort || 'aas'}.json`}
        onClose={() => setShowExportDialog(false)}
        onConfirm={() => { handleExport(); setShowExportDialog(false); }}
      />


      <AddSubmodelDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={addSubmodel} />
      <AddEntityDialog open={showAddEntityDialog} onClose={() => setShowAddEntityDialog(false)} onAdd={createModel} onImport={importAas} />

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogTitle>Elimina AAS</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vuoi eliminare l'AAS "{currentModel?.idShort}" e tutti i suoi submodel? L'azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>Annulla</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { deleteModel(); setShowDeleteConfirm(false); }}
          >
            Elimina
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(submodelToDelete)} onClose={() => setSubmodelToDelete(null)}>
        <DialogTitle>Elimina Submodel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vuoi eliminare il submodel "{submodelToDelete?.idShort}"
            {submodelToDelete?.elements?.length
              ? ` e i suoi ${submodelToDelete.elements.length} ${submodelToDelete.elements.length === 1 ? 'elemento' : 'elementi'}`
              : ''}? L'azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmodelToDelete(null)}>Annulla</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { if (submodelToDelete) removeSubmodel(submodelToDelete.id); setSubmodelToDelete(null); }}
          >
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
      <CommitDialog
        open={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        isFirstSave={!currentModel.documentId}
        currentVersion={currentVersion.version}
        currentRevision={currentVersion.revision}
        currentStatus={currentVersion.status as CommitStatus}
        isSaving={isSaving}
        onCommit={({ message, version, revision, status }) => handleSaveToServer(message, version, revision, status)}
      />

      <ValidationDialog
        open={showValidationDialog}
        onClose={() => { setShowValidationDialog(false); setInitialValidationData(null); }}
        initialValidationData={initialValidationData}
        onImport={(rawData) => {
          const data = rawData as any;
          const shell = data.assetAdministrationShells?.[0];
          const importedModel: AASModel = {
            id: shell?.id || `imported-${Date.now()}`,
            idShort: shell?.idShort || 'Imported_AAS',
            assetId: shell?.assetInformation?.globalAssetId || '',
            description: shell?.description?.[0]?.text || '',
            assetKind: shell?.assetInformation?.assetKind || 'Instance',
            versions: [],
            isImported: true,
            submodels: (data.submodels || []).map((sm: any) => ({
              id: sm.id,
              idShort: sm.idShort,
              semanticId: sm.semanticId?.keys?.[0]?.value || '',
              description: sm.description?.[0]?.text || '',
              category: 'Imported',
              elements: (sm.submodelElements || []).map(mapElement)
            }))
          };
          importAas(importedModel);
          setShowValidationDialog(false);
        }}
      />

      <VersionHistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        documentId={versionDocumentId}
        submodels={submodels}
        modelData={{
          idShort: aasIdShort,
          assetId: aasAssetId,
          assetKind: currentModel.assetKind,
          description: aasDescription,
        }}
        onAfterCommit={refreshModels}
        onOpenCommitDialog={() => setShowCommitDialog(true)}
        onDocumentCreated={(id) => updateCurrentModel({ documentId: id })}
        onCheckoutContent={(content) => {
          if (Array.isArray(content?.submodels)) {
            setSubmodels(content.submodels);
          }
        }}
      />
    </>
  );
}
