import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  AccountTreeRounded,
  AddRounded,
  CheckRounded,
  CloseRounded,
  DeleteRounded,
  EditRounded,
  ErrorOutlineRounded,
  ExpandMoreRounded,
  FileDownloadRounded,
  CloudUploadRounded,
  FormatListBulletedRounded,
  HistoryRounded,
  WarningAmberRounded,
} from '@mui/icons-material';

import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import GraphView from './components/GraphView';

import { useAASContext, XsdValueType, AASModel, validateAAS, ValidationResult } from '@/context/AASContext';
import { useDialogContext } from '@/context/DialogContext';

import ValidationDialog from './dialogs/ValidationDialog';
import AddSubmodelDialog from './dialogs/AddSubmodelDialog';
import AddEntityDialog from './dialogs/AddEntityDialog';
import { buildAasEnvironment } from '@/utils/aas-builder';

// ── Types ─────────────────────────────────────────────────────────────────────
type EditorView = 'list' | 'graph';

// ═══════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════

const XSD_TYPES: XsdValueType[] = ['xs:string', 'xs:int', 'xs:double', 'xs:float', 'xs:boolean', 'xs:date', 'xs:dateTime', 'xs:long', 'xs:short', 'xs:byte', 'xs:anyURI', 'xs:duration', 'xs:decimal'];

export default function AASEditor() {
  const {
    selectedModelId, setSelectedModelId,
    availableModels,
    currentModel, currentVersion,
    createModel,
    updateCurrentModel,
    addSubmodel, removeSubmodel, updateSubmodel, updateElement,
    importAas, setSubmodels
  } = useAASContext();

  const { submodels, idShort: aasIdShort, assetId: aasAssetId, description: aasDescription } = currentModel;

  const { setHandlers } = useDialogContext();

  const [editorView, setEditorView] = useState<EditorView>('list');
  const [expandedSubmodels, setExpandedSubmodels] = useState<Set<string>>(new Set([submodels[0]?.id]));
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [initialValidationData, setInitialValidationData] = useState<Record<string, unknown> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [editingSmIdx, setEditingSmIdx] = useState<Set<number>>(new Set());

  const toggleEditSm = (idx: number) =>
    setEditingSmIdx(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const versionDocumentId = currentModel.documentId ?? null;

  const handleValidateInline = useCallback(() => {
    const result = validateAAS({ idShort: aasIdShort, assetId: aasAssetId }, submodels);
    setValidationResult(result);
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
  }, [aasIdShort, aasAssetId, submodels]);

  const handleExport = useCallback(() => {
    const env = buildAasEnvironment(aasIdShort, aasAssetId, aasDescription, currentModel.assetKind, submodels);
    const data = JSON.stringify(env, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${aasIdShort || 'aas'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [aasIdShort, aasAssetId, aasDescription, currentModel.assetKind, submodels]);

  // Register secondary menu handlers
  useEffect(() => {
    setHandlers({
      onValidateAAS: handleValidateInline,
      onAddSubmodel: () => setShowAddDialog(true),
      onAddEntity: () => setShowAddEntityDialog(true),
      onExportAASX: handleExport,
    });
    return () => setHandlers({});
  }, [setHandlers, handleExport, handleValidateInline]);

  const toggleSubmodel = (id: string) => {
    setExpandedSubmodels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ px: 3, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}
      >
        <FormControl size="small">
          <Select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            sx={{ fontFamily: 'monospace', fontSize: 11 }}
          >
            {availableModels.map(m => (
              <MenuItem key={m.id} value={m.id} sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                {m.idShort.replace('AAS_', '')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Chip
          size="small"
          label={`${currentVersion.status} v${currentVersion.version}`}
          color={currentVersion.status === 'Active' ? 'success' : currentVersion.status === 'Draft' ? 'warning' : 'default'}
          variant="outlined"
        />

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
          variant="contained"
          color={validationResult ? (validationResult.valid ? 'success' : 'error') : 'success'}
          size="small"
          startIcon={validationResult && !validationResult.valid ? <ErrorOutlineRounded /> : <CheckRounded />}
          onClick={handleValidateInline}
        >
          {validationResult
            ? validationResult.valid ? 'Valido' : `${validationResult.errors.length} Errori`
            : 'Validate'}
        </Button>

        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<FileDownloadRounded />}
          onClick={handleExport}
        >
          Export AASX
        </Button>

        {currentModel.isImported && (
          <Button
            variant="contained"
            color="info"
            size="small"
            startIcon={<CloudUploadRounded />}
            onClick={() => alert('Salvataggio sul server in corso... (Funzionalità API non ancora implementata)')}
          >
            Save to Server
          </Button>
        )}

        <Button
          variant={showHistory ? 'contained' : 'outlined'}
          size="small"
          startIcon={<HistoryRounded />}
          onClick={() => setShowHistory(v => !v)}
          sx={{ ml: 0.5 }}
        >
          History
        </Button>
      </Stack>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: AAS Properties */}
        <Box
          sx={{
            width: 280,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflowY: 'auto',
            p: 2.25,
            flexShrink: 0,
          }}
        >
          <Typography variant="overline" color="text.disabled" display="block" mb={1.5}>
            AAS Properties
          </Typography>
          <Stack spacing={1.5}>
            {([
              ['idShort', aasIdShort, (v: string) => updateCurrentModel({ idShort: v }), false],
              ['globalAssetId', aasAssetId, (v: string) => updateCurrentModel({ assetId: v }), false],
              ['description', aasDescription, (v: string) => updateCurrentModel({ description: v }), true],
            ] as [string, string, (v: string) => void, boolean][]).map(([label, value, setter, multiline]) => (
              <Box key={label}>
                <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>{label}</FormLabel>
                <TextField
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  size="small"
                  fullWidth
                  multiline={multiline}
                  rows={multiline ? 2 : undefined}
                  inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
                />
              </Box>
            ))}
            <Box>
              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>assetKind</FormLabel>
              <TextField
                value={currentModel.assetKind}
                size="small"
                fullWidth
                inputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: 11 } }}
              />
            </Box>
          </Stack>

          <Paper variant="outlined" sx={{ mt: 2.5, p: 1.5 }}>
            <Typography variant="overline" color="text.disabled" display="block" mb={1}>
              Stats
            </Typography>
            {([
              ['Submodels', submodels.length],
              ['Properties', submodels.flatMap(s => s.elements).filter(e => e.type === 'Property').length],
              ['Collections', submodels.flatMap(s => s.elements).filter(e => e.type === 'SubmodelElementCollection').length],
            ] as [string, number][]).map(([k, v]) => (
              <Stack key={k} direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{k}</Typography>
                <Typography variant="caption" color="primary.main" fontFamily="monospace">{v}</Typography>
              </Stack>
            ))}
          </Paper>
        </Box>

        {/* Right: Editor Area */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 3,
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'transparent',
            bgcolor: dragOver ? 'rgba(99,102,241,.04)' : 'background.default',
            transition: 'all .2s',
          }}
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
              {/* ── Validation summary bar ── */}
              {validationResult && (
                <Paper
                  variant="outlined"
                  sx={{
                    mb: 2, px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5,
                    borderColor: validationResult.valid ? 'success.main' : 'error.main',
                    bgcolor: validationResult.valid ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)',
                  }}
                >
                  {validationResult.valid
                    ? <CheckRounded sx={{ color: 'success.main', fontSize: 18 }} />
                    : <ErrorOutlineRounded sx={{ color: 'error.main', fontSize: 18 }} />}
                  <Box flex={1}>
                    {validationResult.valid ? (
                      <Typography variant="body2" color="success.main" fontWeight={600}>Modello conforme agli standard IDTA</Typography>
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
                  <IconButton size="small" onClick={() => setValidationResult(null)} sx={{ color: 'text.disabled' }}>
                    <CloseRounded sx={{ fontSize: 16 }} />
                  </IconButton>
                </Paper>
              )}

              {!submodels.length && !dragOver && (
                <Stack alignItems="center" justifyContent="center" height="100%" spacing={0.75}>
                  <Typography fontSize={36}>🟩</Typography>
                  <Typography variant="body2" fontWeight={500} color="text.disabled">Trascina un Submodel qui</Typography>
                  <Typography variant="caption" fontFamily="monospace" color="text.disabled">oppure clicca + sotto</Typography>
                </Stack>
              )}

              {submodels.map((sm, idx) => {
                const isOpen = expandedSubmodels.has(sm.id);
                const isEditing = editingSmIdx.has(idx);
                const smPrefix = `SM[${idx}]`;
                const smErrors = validationResult?.errors.filter(f => f.path.startsWith(smPrefix)) ?? [];
                const smWarnings = validationResult?.warnings.filter(f => f.path.startsWith(smPrefix)) ?? [];
                return (
                  <Paper
                    key={sm.id}
                    variant="outlined"
                    sx={{
                      mb: 1.5,
                      overflow: 'hidden',
                      ...(smErrors.length > 0 && { borderColor: 'error.main', borderLeftWidth: 3 }),
                      ...(smErrors.length === 0 && smWarnings.length > 0 && { borderColor: 'warning.main', borderLeftWidth: 3 }),
                    }}
                  >
                    {/* Submodel header */}
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      sx={{
                        px: 2.25, py: 1.75,
                        cursor: 'pointer',
                        borderBottom: isOpen || isEditing ? 1 : 0,
                        borderColor: 'divider',
                      }}
                      onClick={() => toggleSubmodel(sm.id)}
                    >
                      <Typography fontSize={14}>🟩</Typography>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600} noWrap>{sm.idShort}</Typography>
                        <Typography variant="caption" color="text.disabled" fontFamily="monospace" display="block" noWrap>
                          {sm.id}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${sm.elements?.length || 0} el`}
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
                        onClick={(e) => { e.stopPropagation(); toggleEditSm(idx); }}
                        sx={{ color: isEditing ? 'primary.main' : 'text.disabled' }}
                      >
                        <EditRounded sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); removeSubmodel(sm.id); }}
                        sx={{ color: 'text.disabled' }}
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
                    <Collapse in={isEditing}>
                      <Box sx={{ px: 2.25, py: 1.75, borderBottom: isOpen ? 1 : 0, borderColor: 'divider', bgcolor: 'action.hover' }}>
                        <Stack spacing={1.25}>
                          <Stack direction="row" spacing={1.25}>
                            <Box sx={{ flex: 1 }}>
                              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>idShort</FormLabel>
                              <TextField
                                size="small"
                                fullWidth
                                value={sm.idShort}
                                onChange={(e) => updateSubmodel(sm.id, { idShort: e.target.value })}
                                inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
                              />
                            </Box>
                            <Box sx={{ flex: 2 }}>
                              <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>id (AAS instance IRI)</FormLabel>
                              <TextField
                                size="small"
                                fullWidth
                                value={sm.id}
                                onChange={(e) => updateSubmodel(sm.id, { id: e.target.value })}
                                inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
                              />
                            </Box>
                          </Stack>
                          <Box>
                            <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>semanticId</FormLabel>
                            <TextField
                              size="small"
                              fullWidth
                              value={sm.semanticId}
                              onChange={(e) => updateSubmodel(sm.id, { semanticId: e.target.value })}
                              inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
                            />
                          </Box>
                          <Box>
                            <FormLabel sx={{ fontSize: 10, mb: 0.5, display: 'block' }}>Descrizione</FormLabel>
                            <TextField
                              size="small"
                              fullWidth
                              value={sm.description}
                              onChange={(e) => updateSubmodel(sm.id, { description: e.target.value })}
                            />
                          </Box>
                        </Stack>
                      </Box>
                    </Collapse>

                    {/* Elements */}
                    {isOpen && (
                      <Box sx={{ p: 1.5 }}>
                        {(sm.elements || []).map((el, ei) => {
                          const typeColor: 'default' | 'warning' | 'info' =
                            el.type === 'SubmodelElementCollection' ? 'warning' :
                            el.type === 'Operation' ? 'info' : 'default';
                          const elErrors = validationResult?.errors.filter(
                            f => f.path.startsWith(smPrefix) && f.path.includes(`→ ${el.idShort}`)
                          ) ?? [];
                          const elWarnings = validationResult?.warnings.filter(
                            f => f.path.startsWith(smPrefix) && f.path.includes(`→ ${el.idShort}`)
                          ) ?? [];
                          return (
                            <Paper
                              key={ei}
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                mb: 0.75,
                                ...(elErrors.length > 0 && { borderColor: 'error.main', bgcolor: 'rgba(239,68,68,.04)' }),
                                ...(elErrors.length === 0 && elWarnings.length > 0 && { borderColor: 'warning.main', bgcolor: 'rgba(245,158,11,.04)' }),
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1} mb={el.type === 'Property' ? 1 : 0}>
                                <Chip
                                  size="small"
                                  label={el.type}
                                  color={typeColor}
                                  variant="outlined"
                                  sx={{ fontFamily: 'monospace', fontSize: 9, height: 18 }}
                                />
                                <Typography variant="caption" fontWeight={600} fontFamily="monospace">
                                  {el.idShort}
                                </Typography>
                                {el.required && (
                                  <Typography variant="caption" color="error.main" fontWeight={700} sx={{ fontSize: 9 }}>
                                    REQ
                                  </Typography>
                                )}
                                <Box flex={1} />
                                {el.semanticId && (
                                  <Typography variant="caption" color="text.disabled" fontFamily="monospace" sx={{ fontSize: 9 }}>
                                    {el.semanticId}
                                  </Typography>
                                )}
                              </Stack>

                              {el.type === 'Property' && (
                                <Stack direction="row" spacing={1}>
                                  <TextField
                                    size="small"
                                    value={typeof el.value === 'string' ? el.value : ''}
                                    onChange={(e) => updateElement(sm.id, ei, 'value', e.target.value)}
                                    placeholder={`valore (${el.valueType || 'string'})…`}
                                    inputProps={{ style: { fontFamily: 'monospace', fontSize: 10 } }}
                                    sx={{ flex: 1 }}
                                  />
                                  <FormControl size="small" sx={{ minWidth: 130 }}>
                                    <Select
                                      value={el.valueType || 'xs:string'}
                                      onChange={(e) => updateElement(sm.id, ei, 'valueType', e.target.value)}
                                      sx={{ fontFamily: 'monospace', fontSize: 10 }}
                                    >
                                      {XSD_TYPES.map(t => (
                                        <MenuItem key={t} value={t} sx={{ fontFamily: 'monospace', fontSize: 10 }}>{t}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Stack>
                              )}

                              {el.type === 'MultiLanguageProperty' && (
                                <Stack spacing={0.75} mt={0.5}>
                                  {(['en', 'it', 'de'] as const).map(lang => {
                                    const mlv = typeof el.value === 'object' && el.value !== null ? el.value as Record<string, string> : {};
                                    return (
                                      <Stack key={lang} direction="row" alignItems="center" spacing={0.75}>
                                        <Typography variant="caption" fontFamily="monospace" color="text.disabled" sx={{ width: 20, flexShrink: 0 }}>{lang}</Typography>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          value={mlv[lang] || ''}
                                          onChange={(e) => updateElement(sm.id, ei, 'value', { ...mlv, [lang]: e.target.value })}
                                          placeholder={`testo (${lang})…`}
                                          inputProps={{ style: { fontSize: 10 } }}
                                        />
                                      </Stack>
                                    );
                                  })}
                                </Stack>
                              )}

                              {el.type === 'SubmodelElementCollection' && el.children && (
                                <Box sx={{ mt: 0.75, pl: 1.5, borderLeft: '2px solid', borderColor: 'divider' }}>
                                  {el.children.map((ch, ci) => (
                                    <Stack key={ci} direction="row" alignItems="center" spacing={0.75} py={0.4}>
                                      <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>
                                        {ch.idShort}
                                        {ch.required && <Box component="span" color="error.main"> *</Box>}
                                        <Box component="span" color="text.disabled"> : {ch.type}</Box>
                                      </Typography>
                                      {ch.type === 'Property' && (
                                        <TextField
                                          size="small"
                                          fullWidth
                                          placeholder={ch.valueType ? `(${ch.valueType})` : 'valore…'}
                                          inputProps={{ style: { fontFamily: 'monospace', fontSize: 10 } }}
                                        />
                                      )}
                                    </Stack>
                                  ))}
                                </Box>
                              )}

                              {elErrors.map((f, fi) => (
                                <Stack key={fi} direction="row" alignItems="center" spacing={0.5} mt={0.75}>
                                  <ErrorOutlineRounded sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />
                                  <Typography variant="caption" color="error.main" fontFamily="monospace">{f.msg}</Typography>
                                </Stack>
                              ))}
                              {elWarnings.map((f, fi) => (
                                <Stack key={fi} direction="row" alignItems="center" spacing={0.5} mt={0.75}>
                                  <WarningAmberRounded sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />
                                  <Typography variant="caption" color="warning.main" fontFamily="monospace">{f.msg}</Typography>
                                </Stack>
                              ))}
                            </Paper>
                          );
                        })}
                        {!(sm.elements || []).length && (
                          <Typography variant="caption" fontFamily="monospace" color="text.disabled" textAlign="center" display="block" py={2.5}>
                            Submodel vuoto
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Paper>
                );
              })}

              <Button
                variant="outlined"
                fullWidth
                startIcon={<AddRounded />}
                onClick={() => setShowAddDialog(true)}
                sx={{ mt: 1, borderStyle: 'dashed', fontFamily: 'monospace' }}
              >
                Aggiungi Submodel
              </Button>
            </>
          )}
        </Box>
      </Box>

      <AddSubmodelDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={addSubmodel} />
      <AddEntityDialog open={showAddEntityDialog} onClose={() => setShowAddEntityDialog(false)} onAdd={createModel} />
      
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
              elements: (sm.submodelElements || []).map((el: any) => ({
                idShort: el.idShort,
                type: el.modelType,
                value: el.value as string | undefined,
                valueType: el.valueType,
                semanticId: el.semanticId?.keys?.[0]?.value || '',
                required: false
              }))
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
        onDocumentCreated={(id) => updateCurrentModel({ documentId: id })}
        onCheckoutContent={(content) => {
          if (Array.isArray(content?.submodels)) {
            setSubmodels(content.submodels);
          }
        }}
      />
    </Box>
  );
}
