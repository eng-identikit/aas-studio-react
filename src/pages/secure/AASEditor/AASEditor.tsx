import { memo, useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
  Input,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
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
  WarningAmberRounded,
  EditNoteRounded,
  ArchiveRounded,
  ArrowDropDownRounded,
  Inventory2Rounded,
  WidgetsRounded,
} from '@mui/icons-material';

import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import GraphView from './components/GraphView';

import { useAASContext, XsdValueType, AASModel, SubmodelTemplate, SubmodelElement, SubmodelElementChild, validateAAS, ValidationResult } from '@/context/AASContext';
import { useDialogContext } from '@/context/DialogContext';
import { useAASVersioning } from '@/hooks/useAASVersioning';
import { useCustomSnackbar } from '@/context/SnackbarContext';

import ValidationDialog from './dialogs/ValidationDialog';
import AddSubmodelDialog from './dialogs/AddSubmodelDialog';
import AddEntityDialog from './dialogs/AddEntityDialog';
import CommitDialog from './dialogs/CommitDialog';
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

// Borderless (underline-only) input for the dense element table: reads as text,
// reveals editability on hover/focus. Keeps the value column scannable.
const cellInputSx = {
  '& .MuiInput-input': { fontFamily: 'monospace', fontSize: 11, py: 0.25 },
} as const;

// Make a click handler keyboard-operable on non-button elements (Enter/Space).
const activateOnKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

// Recursively render a container's children as indented sub-rows. Containers
// (Collection/List) can nest to any depth; `path` is the child-index chain from
// the owning top-level element down to this row, used both as the expand key and
// to target updateChild.
interface ChildRowsProps {
  smId: string;
  elIdx: number;
  children: SubmodelElementChild[];
  path: number[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onUpdate: (smId: string, elIdx: number, path: number[], field: string, value: string) => void;
}

function ChildRows({ smId, elIdx, children, path, expanded, onToggle, onUpdate }: ChildRowsProps) {
  const { t } = useTranslation();
  return (
    <>
      {children.map((ch, ci) => {
        const childPath = [...path, ci];
        const isContainer = ch.type === 'SubmodelElementCollection' || ch.type === 'SubmodelElementList';
        const key = `${smId}:${elIdx}:${childPath.join('.')}`;
        const open = expanded.has(key);
        return (
          <Box key={ci}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ py: 0.4 }}
              {...(isContainer && {
                role: 'button',
                tabIndex: 0,
                'aria-expanded': open,
                style: { cursor: 'pointer' },
                onClick: () => onToggle(key),
                onKeyDown: activateOnKey(() => onToggle(key)),
              })}
            >
              <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>
                {ch.idShort || `[${ci}]`}
                {ch.required && <Box component="span" color="error.main"> *</Box>}
                <Box component="span" color="text.secondary"> : {ch.type}</Box>
              </Typography>
              {ch.type === 'Property' && (
                <Input
                  fullWidth
                  value={ch.value || ''}
                  onChange={(e) => onUpdate(smId, elIdx, childPath, 'value', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={ch.valueType ? `(${ch.valueType})` : t('editor.childValuePlaceholder')}
                  inputProps={{ 'aria-label': `${ch.idShort || ci} ${t('editor.colValue')}` }}
                  sx={cellInputSx}
                />
              )}
              {isContainer && (
                <>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ flex: 1 }}>
                    {t('editor.elementsCount', { count: ch.children?.length ?? 0 })}
                  </Typography>
                  <ExpandMoreRounded
                    sx={{
                      color: 'text.secondary',
                      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  />
                </>
              )}
            </Stack>
            {isContainer && (
              <Collapse in={open} unmountOnExit>
                <Box sx={{ pl: 2 }}>
                  {ch.children && ch.children.length > 0 ? (
                    <ChildRows
                      smId={smId}
                      elIdx={elIdx}
                      children={ch.children}
                      path={childPath}
                      expanded={expanded}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                    />
                  ) : (
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">{t('editor.empty')}</Typography>
                  )}
                </Box>
              </Collapse>
            )}
          </Box>
        );
      })}
    </>
  );
}

// Lightweight replacement for a per-row MUI <Select>: renders as plain text and
// mounts the Menu only when clicked. A full Select in every row dominated the
// mount cost of large submodels.
function TypeSelectCell({ value, onChange }: { value: XsdValueType | undefined; onChange: (v: XsdValueType) => void }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        role="button"
        tabIndex={0}
        aria-label={t('editor.changeValueType')}
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        onKeyDown={activateOnKey(function noop() { /* opened via click only */ })}
        sx={{ cursor: 'pointer', flex: 1, minWidth: 0, '&:hover': { color: 'primary.main' } }}
      >
        <Typography variant="caption" fontFamily="monospace" noWrap sx={{ flex: 1, color: 'inherit' }}>
          {value || 'xs:string'}
        </Typography>
        <ArrowDropDownRounded sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
      </Stack>
      {anchor && (
        <Menu anchorEl={anchor} open onClose={() => setAnchor(null)}>
          {XSD_TYPES.map(t => (
            <MenuItem
              key={t}
              selected={t === (value || 'xs:string')}
              onClick={(e) => { e.stopPropagation(); onChange(t); setAnchor(null); }}
              sx={{ fontFamily: 'monospace', fontSize: 11 }}
            >
              {t}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
}

// One table row, memoized: `el` keeps its identity unless that element was edited,
// so typing in a Property re-renders exactly one row. Before, every keystroke
// re-rendered the whole open card (hundreds of MUI inputs on IDTA submodels).
interface ElementRowProps {
  smId: string;
  smPrefix: string;
  el: SubmodelElement;
  ei: number;
  validationResult: ValidationResult | null;
  expandedElements: Set<string>;
  onToggleElement: (key: string) => void;
  onUpdateElement: (smId: string, elIdx: number, field: string, value: string | Record<string, string>) => void;
  onUpdateChild: (smId: string, elIdx: number, path: number[], field: string, value: string) => void;
}

const ElementRow = memo(function ElementRow({
  smId, smPrefix, el, ei, validationResult, expandedElements,
  onToggleElement, onUpdateElement, onUpdateChild,
}: ElementRowProps) {
  const { t } = useTranslation();
  const isContainer = el.type === 'SubmodelElementCollection' || el.type === 'SubmodelElementList';
  const dotColor =
    isContainer ? 'warning.main' :
    el.type === 'Operation' ? 'info.main' : 'primary.main';
  const elKey = `${smId}:${ei}`;
  const elOpen = expandedElements.has(elKey);
  const elErrors = validationResult?.errors.filter(
    f => f.path.startsWith(smPrefix) && f.path.includes(`→ ${el.idShort}`)
  ) ?? [];
  const elWarnings = validationResult?.warnings.filter(
    f => f.path.startsWith(smPrefix) && f.path.includes(`→ ${el.idShort}`)
  ) ?? [];
  const mlv = typeof el.value === 'object' && el.value !== null ? el.value as Record<string, string> : {};
  return (
    <Box
      sx={(theme) => ({
        borderBottom: 1,
        borderColor: 'divider',
        ...(elErrors.length > 0 && { bgcolor: alpha(theme.palette.error.main, 0.06) }),
        ...(elErrors.length === 0 && elWarnings.length > 0 && { bgcolor: alpha(theme.palette.warning.main, 0.06) }),
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2.25, py: 0.5, minHeight: 40, '&:hover': { bgcolor: 'action.hover' } }}
        onClick={isContainer ? () => onToggleElement(elKey) : undefined}
        {...(isContainer && {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': elOpen,
          onKeyDown: activateOnKey(() => onToggleElement(elKey)),
          style: { cursor: 'pointer' },
        })}
      >
        {/* idShort column */}
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: '0 0 38%', minWidth: 0 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
          <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap>{el.idShort}</Typography>
          {el.required && (
            <Typography variant="caption" color="error.main" fontWeight={700} sx={{ fontSize: 10, flexShrink: 0 }}>REQ</Typography>
          )}
        </Stack>

        {/* Value column */}
        <Box sx={{ flex: 1, minWidth: 0 }} onClick={(e) => { if (!isContainer) e.stopPropagation(); }}>
          {el.type === 'Property' && (
            <Input
              fullWidth
              value={typeof el.value === 'string' ? el.value : ''}
              onChange={(e) => onUpdateElement(smId, ei, 'value', e.target.value)}
              placeholder={t('editor.valuePlaceholder', { type: el.valueType || 'string' })}
              inputProps={{ 'aria-label': `${t('editor.colValue')} ${el.idShort}` }}
              sx={cellInputSx}
            />
          )}
          {el.type === 'MultiLanguageProperty' && (
            <Stack spacing={0.25}>
              {(['en', 'it', 'de'] as const).map(lang => (
                <Stack key={lang} direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ width: 18, flexShrink: 0 }}>{lang}</Typography>
                  <Input
                    fullWidth
                    value={mlv[lang] || ''}
                    onChange={(e) => onUpdateElement(smId, ei, 'value', { ...mlv, [lang]: e.target.value })}
                    placeholder={t('editor.textPlaceholder', { lang })}
                    inputProps={{ 'aria-label': `${el.idShort} ${lang}`, style: { fontSize: 11, paddingTop: 2, paddingBottom: 2 } }}
                  />
                </Stack>
              ))}
            </Stack>
          )}
          {isContainer && (
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
              {t('editor.elementsCount', { count: el.children?.length ?? 0 })}
            </Typography>
          )}
          {!isContainer && el.type !== 'Property' && el.type !== 'MultiLanguageProperty' && (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </Box>

        {/* Type column */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: '0 0 140px' }}>
          {el.type === 'Property' ? (
            <TypeSelectCell
              value={el.valueType}
              onChange={(v) => onUpdateElement(smId, ei, 'valueType', v)}
            />
          ) : (
            <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap sx={{ flex: 1 }}>{el.type}</Typography>
          )}
          {isContainer && (
            <ExpandMoreRounded
              sx={{
                color: 'text.secondary',
                transform: elOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                fontSize: 16,
                flexShrink: 0,
              }}
            />
          )}
        </Stack>
      </Stack>

      {/* Container children (indented sub-rows, recursive). unmountOnExit is
          load-bearing: without it every collapsed collection keeps its whole
          hidden subtree of inputs mounted, which froze the expand. */}
      {isContainer && el.children && (
        <Collapse in={elOpen} unmountOnExit>
          <Box sx={{ pl: 4, pr: 2.25, pb: 1 }}>
            {el.children.length > 0 ? (
              <ChildRows
                smId={smId}
                elIdx={ei}
                children={el.children}
                path={[]}
                expanded={expandedElements}
                onToggle={onToggleElement}
                onUpdate={onUpdateChild}
              />
            ) : (
              <Typography variant="caption" fontFamily="monospace" color="text.secondary">{t('editor.empty')}</Typography>
            )}
          </Box>
        </Collapse>
      )}

      {/* Per-element validation messages */}
      {elErrors.map((f, fi) => (
        <Stack key={fi} direction="row" alignItems="center" spacing={0.5} sx={{ px: 2.25, pb: 0.5 }}>
          <ErrorOutlineRounded sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />
          <Typography variant="caption" color="error.main" fontFamily="monospace">{f.msg}</Typography>
        </Stack>
      ))}
      {elWarnings.map((f, fi) => (
        <Stack key={fi} direction="row" alignItems="center" spacing={0.5} sx={{ px: 2.25, pb: 0.5 }}>
          <WarningAmberRounded sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />
          <Typography variant="caption" color="warning.main" fontFamily="monospace">{f.msg}</Typography>
        </Stack>
      ))}
    </Box>
  );
});

// Streams rows into the DOM chunk-by-chunk: mounting hundreds of MUI inputs in
// one commit blocked the main thread for seconds on large IDTA submodels. The
// first chunk paints on click, the rest follows one animation frame at a time.
const ROW_CHUNK = 15;

interface ElementsTableProps {
  smId: string;
  smPrefix: string;
  elements: SubmodelElement[];
  validationResult: ValidationResult | null;
  expandedElements: Set<string>;
  onToggleElement: (key: string) => void;
  onUpdateElement: (smId: string, elIdx: number, field: string, value: string | Record<string, string>) => void;
  onUpdateChild: (smId: string, elIdx: number, path: number[], field: string, value: string) => void;
}

function ElementsTable({
  smId, smPrefix, elements, validationResult, expandedElements,
  onToggleElement, onUpdateElement, onUpdateChild,
}: ElementsTableProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => Math.min(ROW_CHUNK, elements.length));
  useEffect(() => {
    if (visible >= elements.length) return;
    const id = requestAnimationFrame(() => setVisible(v => Math.min(v + ROW_CHUNK, elements.length)));
    return () => cancelAnimationFrame(id);
  }, [visible, elements.length]);

  return (
    <Box>
      {elements.length > 0 && (
        <Stack
          direction="row"
          sx={{ px: 2.25, py: 0.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ flex: '0 0 38%' }}>idShort</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ flex: 1 }}>{t('editor.colValue')}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ flex: '0 0 140px' }}>{t('editor.colType')}</Typography>
        </Stack>
      )}

      {elements.slice(0, visible).map((el, ei) => (
        <ElementRow
          key={ei}
          smId={smId}
          smPrefix={smPrefix}
          el={el}
          ei={ei}
          validationResult={validationResult}
          expandedElements={expandedElements}
          onToggleElement={onToggleElement}
          onUpdateElement={onUpdateElement}
          onUpdateChild={onUpdateChild}
        />
      ))}

      {visible < elements.length && (
        <Typography variant="caption" fontFamily="monospace" color="text.secondary" textAlign="center" display="block" py={1}>
          {t('editor.loadingElements', { visible, total: elements.length })}
        </Typography>
      )}
      {!elements.length && (
        <Typography variant="caption" fontFamily="monospace" color="text.secondary" textAlign="center" display="block" py={2.5}>
          {t('editor.emptySubmodel')}
        </Typography>
      )}
    </Box>
  );
}

// Memoized: with the whole page re-rendering on every context change, typing in a
// Property froze on large models. Props are kept referentially stable so only the
// card whose submodel actually changed re-renders.
interface SubmodelCardProps {
  sm: SubmodelTemplate;
  idx: number;
  isOpen: boolean;
  isEditing: boolean;
  validationResult: ValidationResult | null;
  expandedElements: Set<string>;
  onToggleSubmodel: (id: string) => void;
  onToggleEditSm: (idx: number) => void;
  onDeleteSubmodel: (sm: SubmodelTemplate) => void;
  onToggleElement: (key: string) => void;
  onUpdateSubmodel: (smId: string, patch: Partial<SubmodelTemplate>) => void;
  onUpdateElement: (smId: string, elIdx: number, field: string, value: string | Record<string, string>) => void;
  onUpdateChild: (smId: string, elIdx: number, path: number[], field: string, value: string) => void;
}

const SubmodelCard = memo(function SubmodelCard({
  sm, idx, isOpen, isEditing, validationResult, expandedElements,
  onToggleSubmodel, onToggleEditSm, onDeleteSubmodel, onToggleElement,
  onUpdateSubmodel, onUpdateElement, onUpdateChild,
}: SubmodelCardProps) {
  const { t } = useTranslation();
  const smPrefix = `SM[${idx}]`;
  const smErrors = validationResult?.errors.filter(f => f.path.startsWith(smPrefix)) ?? [];
  const smWarnings = validationResult?.warnings.filter(f => f.path.startsWith(smPrefix)) ?? [];
  const elements = sm.elements || [];
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        overflow: 'hidden',
        ...(smErrors.length > 0 && { borderColor: 'error.main', borderWidth: 2 }),
        ...(smErrors.length === 0 && smWarnings.length > 0 && { borderColor: 'warning.main', borderWidth: 2 }),
      }}
    >
      {/* Submodel header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        sx={{
          px: 2.25, py: 1.75,
          cursor: 'pointer',
          borderBottom: isOpen || isEditing ? 1 : 0,
          borderColor: 'divider',
        }}
        onClick={() => onToggleSubmodel(sm.id)}
        onKeyDown={activateOnKey(() => onToggleSubmodel(sm.id))}
      >
        <WidgetsRounded sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={600} noWrap>{sm.idShort}</Typography>
          <Typography variant="caption" color="text.secondary" fontFamily="monospace" display="block" noWrap>
            {sm.id}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`${elements.length} el`}
          color="primary"
          variant="outlined"
          sx={{ fontFamily: 'monospace', fontSize: 10 }}
        />
        {smErrors.length > 0 && (
          <Chip size="small" icon={<ErrorOutlineRounded />} label={smErrors.length} color="error" sx={{ fontSize: 10, height: 22 }} />
        )}
        {smWarnings.length > 0 && (
          <Chip size="small" icon={<WarningAmberRounded />} label={smWarnings.length} color="warning" sx={{ fontSize: 10, height: 22 }} />
        )}
        <IconButton
          size="small"
          aria-label={t('editor.editSubmodel')}
          onClick={(e) => { e.stopPropagation(); onToggleEditSm(idx); }}
          sx={{ 
            color: 'primary.main',
            backgroundColor: 'background.default'
          }}
        >
          <EditRounded sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label={t('editor.deleteSubmodel')}
          onClick={(e) => { e.stopPropagation(); onDeleteSubmodel(sm); }}
          sx={{ 
            color: 'error.main',
            backgroundColor: 'background.default'
          }}
        >
          <DeleteRounded sx={{ fontSize: 15 }} />
        </IconButton>
        <ExpandMoreRounded
          sx={{
            color: 'text.secondary',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            fontSize: 18,
          }}
        />
      </Stack>

      {/* Submodel identity edit */}
      <Collapse in={isEditing} unmountOnExit>
        <Box sx={{ px: 2.25, py: 1.75, borderBottom: isOpen ? 1 : 0, borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.25}>
              <Box sx={{ flex: 1 }}>
                <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>idShort</FormLabel>
                <TextField
                  size="small"
                  fullWidth
                  value={sm.idShort}
                  onChange={(e) => onUpdateSubmodel(sm.id, { idShort: e.target.value })}
                  inputProps={{ 'aria-label': 'Submodel idShort', style: { fontFamily: 'monospace', fontSize: 11 } }}
                />
              </Box>
              <Box sx={{ flex: 2 }}>
                <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>id (AAS instance IRI)</FormLabel>
                <TextField
                  size="small"
                  fullWidth
                  value={sm.id}
                  onChange={(e) => onUpdateSubmodel(sm.id, { id: e.target.value })}
                  inputProps={{ 'aria-label': 'Submodel id (IRI)', style: { fontFamily: 'monospace', fontSize: 11 } }}
                />
              </Box>
            </Stack>
            <Box>
              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>semanticId</FormLabel>
              <TextField
                size="small"
                fullWidth
                value={sm.semanticId}
                onChange={(e) => onUpdateSubmodel(sm.id, { semanticId: e.target.value })}
                inputProps={{ 'aria-label': 'Submodel semanticId', style: { fontFamily: 'monospace', fontSize: 11 } }}
              />
            </Box>
            <Box>
              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>{t('editor.descriptionLabel')}</FormLabel>
              <TextField
                size="small"
                fullWidth
                value={sm.description}
                onChange={(e) => onUpdateSubmodel(sm.id, { description: e.target.value })}
                inputProps={{ 'aria-label': 'Submodel descrizione' }}
              />
            </Box>
          </Stack>
        </Box>
      </Collapse>

      {/* Elements — dense key/value table (progressively rendered) */}
      {isOpen && (
        <ElementsTable
          smId={sm.id}
          smPrefix={smPrefix}
          elements={elements}
          validationResult={validationResult}
          expandedElements={expandedElements}
          onToggleElement={onToggleElement}
          onUpdateElement={onUpdateElement}
          onUpdateChild={onUpdateChild}
        />
      )}
    </Paper>
  );
});

export default function AASEditor() {
  const { t } = useTranslation();
  const {
    selectedModelId, setSelectedModelId,
    availableModels,
    currentModel, currentVersion,
    createModel,
    deleteModel,
    updateCurrentModel,
    updateVersionStatus,
    addSubmodel, removeSubmodel, updateSubmodel, updateElement, updateChild,
    importAas, refreshModels
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
  const [expandedSubmodels, setExpandedSubmodels] = useState<Set<string>>(new Set([submodels[0]?.id]));
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [initialValidationData, setInitialValidationData] = useState<Record<string, unknown> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submodelToDelete, setSubmodelToDelete] = useState<SubmodelTemplate | null>(null);
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationExpanded, setValidationExpanded] = useState(false);
  const [editingSmIdx, setEditingSmIdx] = useState<Set<number>>(new Set());
  const [railCollapsed, setRailCollapsed] = useState(false);

  useEffect(() => {
    setValidationResult(null);
    setValidationExpanded(false);
  }, [selectedModelId]);

  // Stable callbacks: passed to the memoized SubmodelCard, so they must not be
  // recreated on every render or the memo is useless.
  const toggleEditSm = useCallback((idx: number) =>
    setEditingSmIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    }), []);

  const toggleSubmodel = useCallback((id: string) => {
    setExpandedSubmodels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleElement = useCallback((key: string) => {
    setExpandedElements(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

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
      const errorSmIndices = new Set(
        result.errors
          .map(f => f.path.match(/^SM\[(\d+)\]/)?.[1])
          .filter((v): v is string => v !== undefined)
      );
      setExpandedSubmodels(prev => {
        const next = new Set(prev);
        submodels.forEach((sm, i) => { if (errorSmIndices.has(String(i))) next.add(sm.id); });
        return next;
      });
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

  // Register secondary menu handlers ONCE. handleValidateInline changes on every
  // edit; registering it directly re-set the DialogContext state on each keystroke
  // and re-rendered the whole app. Route through a ref instead.
  const validateRef = useRef(handleValidateInline);
  useEffect(() => { validateRef.current = handleValidateInline; }, [handleValidateInline]);
  useEffect(() => {
    setHandlers({
      onValidateAAS: () => validateRef.current(),
      onAddSubmodel: () => setShowAddDialog(true),
      onAddEntity: () => setShowAddEntityDialog(true),
      onExportAASX: () => setShowExportDialog(true),
    });
    return () => setHandlers({});
  }, [setHandlers]);

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
          showSnackbar(res.message || t('editor.saveError'), 'error');
          return;
        }
        const docId = res.data?.document?.document_id;
        if (docId) {
          // Adopt the server-normalized snapshot (with documentId) for this model,
          // replacing the local working copy now that it is persisted.
          await refreshModels(currentModel.id);
          showSnackbar(t('editor.savedToServer'), 'success');
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
          showSnackbar(res.message || t('editor.commitError'), 'error');
          return;
        }
        await refreshModels(currentModel.id);
        showSnackbar(t('editor.commitSaved'), 'success');
      }
    } catch (err: any) {
      showSnackbar(err?.message || t('editor.saveServerError'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [aasIdShort, aasAssetId, aasDescription, submodels, currentModel, createDocument, commitSubmodel, refreshModels, showSnackbar, t]);

  // Empty state: no AAS model yet (fresh DB / nothing imported). Placed after
  // ALL hooks so the hook order never changes between renders; the "Nuova
  // entità" menu handler is already registered above, so it works here too.
  if (!currentModel) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Stack alignItems="center" spacing={1.5} sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Inventory2Rounded sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6" fontWeight={600}>{t('editor.noModelTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('editor.noModelBody')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => setShowAddEntityDialog(true)}
            sx={{ mt: 1 }}
          >
            {t('editor.newModel')}
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

  const stats: [string, number][] = [
    ['Submodels', submodels.length],
    ['Properties', submodels.flatMap(s => s.elements).filter(e => e.type === 'Property').length],
    ['Collections', submodels.flatMap(s => s.elements).filter(e => e.type === 'SubmodelElementCollection').length],
  ];

  return (
    <>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* ── Model rail (replaces the model dropdown) ── */}
        <Box
          component="nav"
          aria-label={t('editor.modelsNav')}
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
              <Typography variant="overline" color="text.secondary" noWrap>{t('editor.models')}</Typography>
            )}
            <Tooltip title={railCollapsed ? t('editor.expandList') : t('editor.collapseList')} arrow placement="right">
              <IconButton
                size="small"
                onClick={() => setRailCollapsed(v => !v)}
                aria-label={railCollapsed ? t('editor.expandList') : t('editor.collapseList')}
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
                const showInfo = selected && !railCollapsed;
                return (
                  <Tooltip key={m.id} title={railCollapsed ? name : ''} placement="right" arrow disableHoverListener={!railCollapsed}>
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-current={selected}
                      onClick={() => setSelectedModelId(m.id)}
                      onKeyDown={activateOnKey(() => setSelectedModelId(m.id))}
                      sx={{
                        px: railCollapsed ? 0 : 1,
                        py: 0.75,
                        borderRadius: 1,
                        cursor: 'pointer',
                        color: selected ? 'primary.main' : 'text.primary',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        justifyContent={railCollapsed ? 'center' : 'flex-start'}
                      >
                        <Inventory2Rounded sx={{ fontSize: 18, flexShrink: 0, color: selected ? 'primary.main' : 'text.secondary' }} />
                        {!railCollapsed && (
                          <Typography variant="body2" noWrap fontFamily="monospace" fontWeight={selected ? 600 : 400} sx={{ flex: 1, minWidth: 0 }}>
                            {name}
                          </Typography>
                        )}
                        {showInfo && (
                          <Tooltip title={t('editor.deleteModel')} arrow>
                            <IconButton
                              size="small"
                              aria-label={`${t('common.buttons.delete')} ${name}`}
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                              sx={{ 
                                flexShrink: 0, my: -0.5, 
                                color: 'error.main',
                                backgroundColor: 'background.default' }}
                            >
                              <DeleteRounded 
                              sx={{ 
                                color: 'error.main'
                              }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                      {/* Model description, inline under the selected row (replaces
                          the old "Dettagli" popover in the toolbar) */}
                      {showInfo && m.description && (
                        <Box sx={{ mt: 0.5, pl: 3.25 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {m.description}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
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

              <Tooltip title={t('editor.statusTooltip')} arrow>
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
                  <Typography variant="caption" color="warning.main" fontWeight={600}>{t('editor.unsaved')}</Typography>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CheckRounded sx={{ fontSize: 14, color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">{t('editor.saved')}</Typography>
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
                  <FormatListBulletedRounded sx={{ fontSize: 16, mr: 0.5 }} /> {t('editor.viewList')}
                </ToggleButton>
                <ToggleButton value="graph">
                  <AccountTreeRounded sx={{ fontSize: 16, mr: 0.5 }} /> {t('editor.viewGraph')}
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {/* Metadata row — actions aligned right */}
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

              {/* Single flex item so the two actions never wrap apart */}
              <Stack direction="row" spacing={1} sx={{ ml: 'auto', flexShrink: 0 }}>
                <Button
                  variant={showHistory ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<HistoryRounded />}
                  onClick={() => setShowHistory(v => !v)}
                >
                  {t('editor.historyBtn')}
                </Button>

                <Tooltip title={t('editor.commitTooltip')} arrow>
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <CommitRounded />}
                      onClick={() => setShowCommitDialog(true)}
                      disabled={isSaving || (!currentModel.dirty && Boolean(currentModel.documentId))}
                    >
                      {t('editor.commit')}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
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
                {t('editor.localCommitStatus')}
              </Typography>
            </Box>
            {([
              { status: 'Draft',      icon: <EditNoteRounded fontSize="small" />,      color: 'warning.main' },
              { status: 'Active',     icon: <CheckCircleRounded fontSize="small" />,   color: 'success.main' },
              { status: 'Deprecated', icon: <ArchiveRounded fontSize="small" />,       color: 'text.secondary' },
            ] as const).map(({ status, icon, color }) => (
              <MenuItem
                key={status}
                selected={currentVersion.status === status}
                onClick={() => { updateVersionStatus(status); setStatusMenuAnchor(null); }}
                sx={{ borderRadius: 1, mx: 0.5, mb: 0.25 }}
              >
                <ListItemIcon sx={{ color }}>{icon}</ListItemIcon>
                <ListItemText
                  primary={status}
                  secondary={t(`editor.statusDesc.${status}`)}
                  primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }}
                  secondaryTypographyProps={{ fontSize: 11 }}
                />
              </MenuItem>
            ))}
          </Menu>

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
              <>
                {/* Scrollable content area */}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3, pb: 1 }}>
                {/* ── Validation summary bar ── */}
                {validationResult && (
                  <Paper
                    variant="outlined"
                    sx={(theme) => ({
                      mb: 2,
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
                              {t('editor.compliantWithWarnings', { count: validationResult.warnings.length })}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="success.main" fontWeight={600}>{t('editor.compliant')}</Typography>
                          )
                        ) : (
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" color="error.main" fontWeight={600}>
                              {t('editor.errorsCount', { count: validationResult.errors.length })}
                            </Typography>
                            {validationResult.warnings.length > 0 && (
                              <Typography variant="body2" color="warning.main" fontWeight={600}>
                                {t('editor.warningsCount', { count: validationResult.warnings.length })}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Box>
                      {(validationResult.errors.length + validationResult.warnings.length) > 0 && (
                        <IconButton size="small" aria-label={t('editor.showValidationDetails')} onClick={() => setValidationExpanded(e => !e)} sx={{ color: 'text.secondary' }}>
                          <ExpandMoreRounded sx={{ fontSize: 18, transition: 'transform .2s', transform: validationExpanded ? 'rotate(180deg)' : 'none' }} />
                        </IconButton>
                      )}
                      <IconButton size="small" aria-label={t('editor.closeValidation')} onClick={() => setValidationResult(null)} sx={{ color: 'text.secondary' }}>
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

                {!submodels.length && !dragOver && (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', minHeight: 200 }} spacing={0.75}>
                    <WidgetsRounded sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Typography variant="body2" fontWeight={500} color="text.secondary">{t('editor.dropSubmodel')}</Typography>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">{t('editor.orUseAdd')}</Typography>
                  </Stack>
                )}

                {submodels.map((sm, idx) => (
                  <SubmodelCard
                    key={sm.id}
                    sm={sm}
                    idx={idx}
                    isOpen={expandedSubmodels.has(sm.id)}
                    isEditing={editingSmIdx.has(idx)}
                    validationResult={validationResult}
                    expandedElements={expandedElements}
                    onToggleSubmodel={toggleSubmodel}
                    onToggleEditSm={toggleEditSm}
                    onDeleteSubmodel={setSubmodelToDelete}
                    onToggleElement={toggleElement}
                    onUpdateSubmodel={updateSubmodel}
                    onUpdateElement={updateElement}
                    onUpdateChild={updateChild}
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
                    {t('editor.addSubmodel')}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>


      <ConfirmExportDialog
        open={showExportDialog}
        fileName={`${aasIdShort || 'aas'}.json`}
        onClose={() => setShowExportDialog(false)}
        onConfirm={() => { handleExport(); setShowExportDialog(false); }}
      />


      <AddSubmodelDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={addSubmodel} />
      <AddEntityDialog open={showAddEntityDialog} onClose={() => setShowAddEntityDialog(false)} onAdd={createModel} onImport={importAas} />

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogTitle>{t('editor.deleteAasTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('editor.deleteAasMessage', { name: currentModel?.idShort })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>{t('common.buttons.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { deleteModel(); setShowDeleteConfirm(false); }}
          >
            {t('common.buttons.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(submodelToDelete)} onClose={() => setSubmodelToDelete(null)}>
        <DialogTitle>{t('editor.deleteSmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('editor.deleteSmMessage', {
              name: submodelToDelete?.idShort,
              elements: submodelToDelete?.elements?.length
                ? t('editor.deleteSmElements', { count: submodelToDelete.elements.length })
                : '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmodelToDelete(null)}>{t('common.buttons.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { if (submodelToDelete) removeSubmodel(submodelToDelete.id); setSubmodelToDelete(null); }}
          >
            {t('common.buttons.delete')}
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
        onAfterCommit={() => refreshModels(currentModel.id)}
        onOpenCommitDialog={() => setShowCommitDialog(true)}
        onDocumentCreated={(id) => updateCurrentModel({ documentId: id })}
        onCheckoutContent={(content) => {
          // Load a past snapshot into the working copy. Restore every field the
          // snapshot carries (saved in handleSaveToServer), not just submodels.
          const patch: Partial<AASModel> = {};
          if (Array.isArray(content?.submodels)) patch.submodels = content.submodels;
          if (typeof content?.idShort === 'string') patch.idShort = content.idShort;
          if (typeof content?.assetId === 'string') patch.assetId = content.assetId;
          if (typeof content?.description === 'string') patch.description = content.description;
          if (Object.keys(patch).length > 0) updateCurrentModel(patch);
        }}
      />
    </>
  );
}
