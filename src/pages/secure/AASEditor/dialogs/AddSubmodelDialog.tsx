import { useState, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grow,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddRounded,
  CheckRounded,
  CloseRounded,
  ErrorOutlineRounded,
  SearchRounded,
  SendRounded,
  SmartToyRounded,
} from '@mui/icons-material';

import type { AxiosInstance } from 'axios';
import type { SubmodelTemplate, SubmodelElement, SubmodelElementChild, ElementType, XsdValueType } from '@/context/AASContext';
import { useApiManager } from '@/api/apiManger';

// ── IDTA catalog ─────────────────────────────────────────────────────────────

const RAW_BASE =
  'https://raw.githubusercontent.com/admin-shell-io/submodel-templates/main/';

interface CatalogEntry {
  id: string;
  name: string;
  version: string;
  idtaCode: string;
  fileType: 'Template' | 'Example' | 'Sample' | 'Generic';
  metamodel: string;  // e.g. "3.0", "3.1" — extensible for future versions
  path: string;
  downloadUrl: string;
  category: string;
}

let catalogCache: CatalogEntry[] | null = null;

function deriveCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('nameplate') || n.includes('identification')) return 'Identification';
  if (n.includes('technical data')) return 'Technical';
  if (n.includes('document') || n.includes('handover')) return 'Documentation';
  if (n.includes('maintenance') || n.includes('service')) return 'Maintenance';
  if (n.includes('carbon') || n.includes('footprint') || n.includes('passport') || n.includes('sustainability')) return 'Sustainability';
  if (n.includes('bill of') || n.includes('bom') || n.includes('hierarchy')) return 'Structure';
  if (n.includes('time series') || n.includes('operational')) return 'Operational';
  if (n.includes('artificial') || n.includes('machine learning')) return 'AI';
  if (n.includes('asset interface') || n.includes('connectivity')) return 'Connectivity';
  if (n.includes('safety') || n.includes('alarm')) return 'Safety';
  return 'Other';
}

function parseEntry(path: string): CatalogEntry | null {
  // published/[Name]/[Major]/[Minor]/([Patch]/)?[filename].json
  const rel = path.replace('published/', '');
  const parts = rel.split('/');
  if (parts.length < 3) return null;

  const name = parts[0];
  const filename = parts[parts.length - 1];
  const versionParts = parts.slice(1, parts.length - 1);
  const version = versionParts.join('.');

  const idtaMatch = filename.match(/IDTA[- ](\d+)/i);
  const idtaCode = idtaMatch ? `IDTA ${idtaMatch[1]}` : '';

  let fileType: CatalogEntry['fileType'] = 'Generic';
  if (filename.includes('_Template_')) fileType = 'Template';
  else if (filename.includes('_Example_')) fileType = 'Example';
  else if (filename.includes('_Sample_')) fileType = 'Sample';

  // Extract metamodel version from suffix, e.g. "forAASMetamodelV3.1" → "3.1"
  const metamodelMatch = filename.match(/forAASMetamodelV(\d+(?:[._]\d+)*)/i);
  const metamodel = metamodelMatch ? metamodelMatch[1].replace('_', '.') : '3.0';

  return {
    id: `${name}__${version}__${fileType}__mm${metamodel}`,
    name,
    version,
    idtaCode,
    fileType,
    metamodel,
    path,
    downloadUrl: RAW_BASE + path,
    category: deriveCategory(name),
  };
}

async function fetchCatalog(api: AxiosInstance): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;

  const { data } = await api.get<{ data: string[] }>('/v1/idta/catalog');
  const paths: string[] = data.data;

  const entries: CatalogEntry[] = [];
  for (const p of paths) {
    const entry = parseEntry(p);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  catalogCache = entries;
  return entries;
}

// ── AAS JSON → SubmodelTemplate mapper ──────────────────────────────────────

function extractSemanticId(semanticId: unknown): string {
  if (!semanticId || typeof semanticId !== 'object') return '';
  const obj = semanticId as Record<string, unknown>;
  const keys = (obj.keys ?? obj.Keys) as Array<Record<string, string>> | undefined;
  return keys?.[0]?.value ?? '';
}

function mapAasElement(el: unknown): SubmodelElement {
  const e = el as Record<string, unknown>;
  const modelType = String(e.modelType ?? '');
  const base = {
    idShort: String(e.idShort ?? ''),
    semanticId: extractSemanticId(e.semanticId),
    required: false,
  };
  // Both containers carry nested elements under `value`. List items have no
  // idShort (AASd-120), so filter on `modelType`, not `idShort`, and recurse.
  if (modelType === 'SubmodelElementCollection' || modelType === 'SubmodelElementList') {
    const raw = (e.value as unknown[]) ?? [];
    return {
      ...base,
      type: modelType as ElementType,
      children: (Array.isArray(raw) ? raw : [])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && 'modelType' in c)
        .map(mapAasElement) as SubmodelElementChild[],
    };
  }
  if (modelType === 'MultiLanguageProperty') return { ...base, type: 'MultiLanguageProperty', value: {} };
  if (modelType === 'File') return { ...base, type: 'File', contentType: String(e.contentType ?? ''), value: '' };
  if (modelType === 'Blob') return { ...base, type: 'Blob', contentType: String(e.contentType ?? '') };
  if (modelType === 'ReferenceElement') return { ...base, type: 'ReferenceElement' };
  if (modelType === 'Operation') return { ...base, type: 'Operation' };
  return {
    ...base,
    type: 'Property',
    valueType: (e.valueType as XsdValueType) ?? 'xs:string',
    value: '',
  };
}

function mapAasElements(elements: unknown[]): SubmodelElement[] {
  return Array.isArray(elements) ? elements.map(mapAasElement) : [];
}

async function fetchSubmodelTemplate(entry: CatalogEntry): Promise<SubmodelTemplate> {
  const res = await fetch(entry.downloadUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as Record<string, unknown>;

  // IDTA JSON files are wrapped: { assetAdministrationShells, submodels: [...], conceptDescriptions }
  const submodelsArr = json.submodels as Array<Record<string, unknown>> | undefined;
  const submodel: Record<string, unknown> = submodelsArr?.[0] ?? json;

  const semanticId =
    extractSemanticId(submodel.semanticId) || String(submodel.id ?? entry.downloadUrl);
  const elements = mapAasElements((submodel.submodelElements as unknown[]) ?? []);

  return {
    id: semanticId,
    idShort: String(submodel.idShort ?? entry.name),
    semanticId,
    description: `${entry.name} v${entry.version}`,
    category: entry.category,
    elements,
  };
}

// ── Chatbot ──────────────────────────────────────────────────────────────────
// Responses live in the i18n catalog under addSubmodel.chat.*; this resolves
// the message to the matching key so the component translates at render time.

function getChatResponseKey(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes('nameplate') || l.includes('identificaz') || l.includes('serial'))
    return 'addSubmodel.chat.nameplate';
  if (l.includes('mainten') || l.includes('manutenzione') || l.includes('predittiv'))
    return 'addSubmodel.chat.maintenance';
  if (l.includes('tecnic') || l.includes('technical') || l.includes('specs'))
    return 'addSubmodel.chat.technical';
  if (l.includes('document') || l.includes('manuale') || l.includes('handover'))
    return 'addSubmodel.chat.documentation';
  if (l.includes('carbon') || l.includes('co2') || l.includes('pcf'))
    return 'addSubmodel.chat.carbon';
  if (l.includes('bom') || l.includes('distinta') || l.includes('material'))
    return 'addSubmodel.chat.bom';
  if (l.includes('operat') || l.includes('runtime') || l.includes('time series'))
    return 'addSubmodel.chat.operational';
  if (l.includes('eclass') || l.includes('semantic') || l.includes('0173'))
    return 'addSubmodel.chat.eclass';
  return 'addSubmodel.chat.noMatch';
}

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'bot' | 'user'; text: string };

interface AddSubmodelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (sm: SubmodelTemplate) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AddSubmodelDialog({ open, onClose, onAdd }: AddSubmodelDialogProps) {
  const { t } = useTranslation();
  const api = useApiManager();
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [onlyTemplates, setOnlyTemplates] = useState(true);
  const [metamodelFilter, setMetamodelFilter] = useState<string>('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState({ idShort: '', semanticId: '', description: '' });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    { role: 'bot', text: t('addSubmodel.chat.default') },
  ]);
  const [chatInput, setChatInput] = useState('');

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (catalogCache) {
      setCatalog(catalogCache);
      return;
    }
    setCatalogLoading(true);
    setCatalogError(null);
    fetchCatalog(api)
      .then(setCatalog)
      .catch((e: Error) => setCatalogError(e.message))
      .finally(() => setCatalogLoading(false));
  }, [open]);

  const categories = ['All', ...Array.from(new Set(catalog.map(e => e.category))).sort()];
  const metamodelVersions = ['All', ...Array.from(new Set(catalog.map(e => e.metamodel))).sort()];

  const filtered = catalog.filter(e => {
    if (onlyTemplates && e.fileType !== 'Template') return false;
    if (metamodelFilter !== 'All' && e.metamodel !== metamodelFilter) return false;
    if (catFilter !== 'All' && e.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.idtaCode.toLowerCase().includes(q) ||
        e.version.includes(q)
      );
    }
    return true;
  });

  const canAdd = tab === 'catalog' ? !!selected : !!custom.idShort.trim();

  const resetState = () => {
    setTab('catalog');
    setSearch('');
    setCatFilter('All');
    setOnlyTemplates(true);
    setMetamodelFilter('All');
    setSelected(null);
    setCustom({ idShort: '', semanticId: '', description: '' });
    setChatMessages([{ role: 'bot', text: t('addSubmodel.chat.default') }]);
    setChatInput('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAdd = async () => {
    if (tab === 'catalog' && selected) {
      const entry = catalog.find(e => e.id === selected);
      if (!entry) return;
      setAdding(true);
      setCatalogError(null);
      try {
        const template = await fetchSubmodelTemplate(entry);
        onAdd({
          ...template,
          id: `${template.semanticId}:inst:${Date.now()}`,
          elements: template.elements.map(el => ({
            ...el,
            value: el.type === 'MultiLanguageProperty' ? {} : '',
          })),
        });
        handleClose();
      } catch (err: unknown) {
        setCatalogError(t('addSubmodel.templateLoadError', { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setAdding(false);
      }
      return;
    }
    if (tab === 'custom' && custom.idShort.trim()) {
      onAdd({
        id: `custom-${Date.now()}`,
        idShort: custom.idShort,
        semanticId: custom.semanticId || `urn:custom:${custom.idShort}:1:0`,
        description: custom.description,
        category: 'Custom',
        elements: [],
      });
      handleClose();
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    setTimeout(
      () => setChatMessages(prev => [...prev, { role: 'bot', text: t(getChatResponseKey(msg)) }]),
      500,
    );
  };

  const renderBoldText = (text: string) =>
    text.split('**').map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
    );

  return (
    <Dialog
      open={open}
      onClose={(_: unknown, reason: string) => {
        if (reason !== 'backdropClick') handleClose();
      }}
      fullWidth
      maxWidth="xl"
      slots={{ transition: Grow }}
      slotProps={{ transition: { timeout: 300 } }}
      PaperProps={{ sx: { height: '85vh' } }}
    >
      {/* ── Title ── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AddRounded />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            {t('addSubmodel.title')}
          </Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace">
            {catalog.length > 0 ? t('addSubmodel.subtitleCount', { count: catalog.length }) : t('addSubmodel.subtitleLoading')}
          </Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={handleClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ── Body ── */}
      <DialogContent sx={{ display: 'flex', p: 0, overflow: 'hidden' }}>
        {/* ── LEFT ── */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab value="catalog" label={t('addSubmodel.tabCatalog')} />
            <Tab value="custom" label={t('addSubmodel.tabCustom')} />
          </Tabs>

          {tab === 'catalog' ? (
            <>
              {/* Search + toggle chips */}
              <Stack spacing={1} p={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    placeholder={t('addSubmodel.searchPlaceholder')}
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    sx={{ flex: 1 }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRounded fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Chip
                    label={t('addSubmodel.onlyTemplates')}
                    size="small"
                    clickable
                    variant={onlyTemplates ? 'filled' : 'outlined'}
                    color={onlyTemplates ? 'primary' : 'default'}
                    onClick={() => setOnlyTemplates(p => !p)}
                  />
                  {metamodelVersions.map(v => (
                    <Chip
                      key={v}
                      label={v === 'All' ? t('addSubmodel.allMetamodels') : `AAS ${v}`}
                      size="small"
                      clickable
                      variant={metamodelFilter === v ? 'filled' : 'outlined'}
                      color={metamodelFilter === v ? 'secondary' : 'default'}
                      onClick={() => setMetamodelFilter(v)}
                    />
                  ))}
                </Stack>
                {/* Category chips */}
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {categories.map(c => (
                    <Chip
                      key={c}
                      label={c}
                      size="small"
                      clickable
                      variant={catFilter === c ? 'filled' : 'outlined'}
                      color={catFilter === c ? 'primary' : 'default'}
                      onClick={() => setCatFilter(c)}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* List */}
              <Box flex={1} overflow="auto" px={2} pb={2}>
                {catalogLoading && (
                  <Stack alignItems="center" justifyContent="center" height="100%" spacing={1.5}>
                    <CircularProgress size={32} />
                    <Typography variant="caption" color="text.secondary">
                      {t('addSubmodel.loadingCatalog')}
                    </Typography>
                  </Stack>
                )}

                {catalogError && !catalogLoading && (
                  <Stack alignItems="center" justifyContent="center" height="100%" spacing={1}>
                    <ErrorOutlineRounded color="error" />
                    <Typography variant="caption" color="error" textAlign="center">
                      {catalogError}
                    </Typography>
                  </Stack>
                )}

                {!catalogLoading && !catalogError && filtered.map(entry => (
                  <Paper
                    key={entry.path}
                    variant="outlined"
                    onClick={() => setSelected(entry.id)}
                    sx={{
                      p: 1.75,
                      mb: 0.75,
                      cursor: 'pointer',
                      borderColor: selected === entry.id ? 'primary.main' : 'divider',
                      bgcolor: selected === entry.id ? 'action.selected' : 'background.paper',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle2">{entry.name}</Typography>
                        <Chip
                          label={`v${entry.version}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: 9 }}
                        />
                        <Chip
                          label={`AAS ${entry.metamodel}`}
                          size="small"
                          color={entry.metamodel === '3.0' ? 'default' : 'secondary'}
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: 9 }}
                        />
                        {entry.fileType !== 'Template' && (
                          <Chip
                            label={entry.fileType}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 9 }}
                          />
                        )}
                      </Stack>
                      {selected === entry.id && <CheckRounded color="primary" fontSize="small" />}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      display="block"
                      mt={0.5}
                      fontFamily="monospace"
                    >
                      {entry.idtaCode && `${entry.idtaCode} · `}{entry.category}
                    </Typography>
                  </Paper>
                ))}

                {!catalogLoading && !catalogError && filtered.length === 0 && catalog.length > 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                    {t('addSubmodel.noResults')}
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Stack gap={2} p={2} flex={1}>
              <TextField
                label="idShort *"
                size="small"
                fullWidth
                value={custom.idShort}
                placeholder="MyCustomSubmodel"
                onChange={e => setCustom(p => ({ ...p, idShort: e.target.value }))}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
              />
              <TextField
                label="semanticId"
                size="small"
                fullWidth
                value={custom.semanticId}
                placeholder="urn:org:submodel:Name:1:0"
                onChange={e => setCustom(p => ({ ...p, semanticId: e.target.value }))}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
              />
              <TextField
                label={t('addSubmodel.descriptionLabel')}
                size="small"
                fullWidth
                multiline
                rows={3}
                value={custom.description}
                onChange={e => setCustom(p => ({ ...p, description: e.target.value }))}
              />
            </Stack>
          )}

          {/* Footer */}
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1}
            p={1.5}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            <Button onClick={handleClose}>{t('common.buttons.cancel')}</Button>
            <Button
              variant="contained"
              disabled={!canAdd || adding}
              startIcon={
                adding ? <CircularProgress size={14} color="inherit" /> : <AddRounded />
              }
              onClick={handleAdd}
            >
              {adding ? t('addSubmodel.adding') : t('addSubmodel.add')}
            </Button>
          </Stack>
        </Box>

        {/* ── CHATBOT ── */}
        <Box
          sx={{
            width: 340,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            p={1.75}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}>
              <SmartToyRounded sx={{ fontSize: 16 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" lineHeight={1.2}>
                {t('addSubmodel.assistant')}
              </Typography>
              <Typography variant="caption" color="primary.main" fontFamily="monospace">
                {t('addSubmodel.online')}
              </Typography>
            </Box>
          </Stack>

          <Box flex={1} overflow="auto" p={1.75} display="flex" flexDirection="column" gap={1}>
            {chatMessages.map((m, i) => (
              <Box
                key={i}
                display="flex"
                justifyContent={m.role === 'user' ? 'flex-end' : 'flex-start'}
              >
                <Paper
                  sx={{
                    maxWidth: '88%',
                    p: 1.25,
                    bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius:
                      m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  }}
                  elevation={0}
                >
                  <Typography variant="caption" whiteSpace="pre-wrap" lineHeight={1.6}>
                    {renderBoldText(m.text)}
                  </Typography>
                </Paper>
              </Box>
            ))}
          </Box>

          <Stack
            direction="row"
            spacing={0.75}
            p={1.5}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            <TextField
              size="small"
              fullWidth
              value={chatInput}
              placeholder={t('addSubmodel.chatPlaceholder')}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && sendChat()}
            />
            <IconButton color="primary" onClick={sendChat} sx={{ flexShrink: 0 }}>
              <SendRounded />
            </IconButton>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
