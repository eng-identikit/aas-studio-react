import { useState, type KeyboardEvent, type ChangeEvent } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
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
  SearchRounded,
  SendRounded,
  SmartToyRounded,
} from '@mui/icons-material';

import { SM_CATALOG } from '@/context/AASContext';
import type { SubmodelTemplate } from '@/context/AASContext';

// ── Chatbot data ────────────────────────────────────────────────────────────

const CHATBOT_RESPONSES: Record<string, string> = {
  default:
    "Ciao! Sono l'assistente AAS. Posso aiutarti a trovare il submodel giusto.\n\nProva:\n• \"Quale submodel per manutenzione?\"\n• \"Cos'è ECLASS?\"\n• \"Submodel per carbon footprint\"",
  nameplate:
    '**Nameplate** (urn:idta:aas:submodel:Nameplate:1:0).\nContiene ManufacturerName, SerialNumber, YearOfConstruction.',
  maintenance:
    'Usa **PredictiveMaintenance**:\n• MaintenanceSchedule\n• RemainingUsefulLife\n• HealthIndex',
  technical:
    'Usa **TechnicalData** v1.2:\n• GeneralInformation\n• TechnicalProperties (ECLASS)',
  documentation:
    'Usa **HandoverDocumentation** v1.2 con DocumentId, DocumentTitle e DocumentFile.',
  carbon:
    'Usa **CarbonFootprint** (Catena-X):\n• CO2EquivalentTotal\n• ReferenceUnit',
  bom: 'Usa **BillOfMaterial** con PartNumber, Quantity e PartReference.',
  operational:
    'Usa **OperationalData**:\n• OperatingHours\n• CycleCount\n• CurrentTemperature',
  eclass:
    'ECLASS: `0173-1#02-XXXYYY#ZZZ`\nCerca su eclass.eu per i codici esatti.',
};

function getChatResponse(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes('nameplate') || l.includes('identificaz') || l.includes('serial'))
    return CHATBOT_RESPONSES.nameplate;
  if (l.includes('mainten') || l.includes('manutenzione') || l.includes('predittiv'))
    return CHATBOT_RESPONSES.maintenance;
  if (l.includes('tecnic') || l.includes('technical') || l.includes('specs'))
    return CHATBOT_RESPONSES.technical;
  if (l.includes('document') || l.includes('manuale') || l.includes('handover'))
    return CHATBOT_RESPONSES.documentation;
  if (l.includes('carbon') || l.includes('co2') || l.includes('pcf'))
    return CHATBOT_RESPONSES.carbon;
  if (l.includes('bom') || l.includes('distinta') || l.includes('material'))
    return CHATBOT_RESPONSES.bom;
  if (l.includes('operat') || l.includes('runtime') || l.includes('temperatur'))
    return CHATBOT_RESPONSES.operational;
  if (l.includes('eclass') || l.includes('semantic') || l.includes('0173'))
    return CHATBOT_RESPONSES.eclass;
  return 'Non ho trovato un match. Prova:\n• "submodel per manutenzione"\n• "come funziona ECLASS"\n• "dati operativi"';
}

// ── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'bot' | 'user'; text: string };

interface AddSubmodelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (sm: SubmodelTemplate) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AddSubmodelDialog({ open, onClose, onAdd }: AddSubmodelDialogProps) {
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState({ idShort: '', semanticId: '', description: '' });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: CHATBOT_RESPONSES.default },
  ]);
  const [chatInput, setChatInput] = useState('');

  const categories = ['All', ...new Set(SM_CATALOG.map((s) => s.category))];

  const filtered = SM_CATALOG.filter((s) => {
    const matchSearch =
      !search ||
      s.idShort.toLowerCase().includes(search.toLowerCase()) ||
      s.semanticId.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (catFilter === 'All' || s.category === catFilter);
  });

  const canAdd = tab === 'catalog' ? !!selected : !!custom.idShort.trim();

  const resetState = () => {
    setTab('catalog');
    setSearch('');
    setCatFilter('All');
    setSelected(null);
    setCustom({ idShort: '', semanticId: '', description: '' });
    setChatMessages([{ role: 'bot', text: CHATBOT_RESPONSES.default }]);
    setChatInput('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAdd = () => {
    if (tab === 'catalog' && selected) {
      const template = SM_CATALOG.find((s) => s.id === selected);
      if (template) {
        onAdd({
          ...template,
          id: `${template.semanticId}:inst:${Date.now()}`,
          elements: template.elements.map((e) => ({
            ...e,
            value: e.type === 'MultiLanguageProperty' ? {} : '',
          })),
        });
      }
    } else if (tab === 'custom' && custom.idShort.trim()) {
      onAdd({
        id: `custom-${Date.now()}`,
        idShort: custom.idShort,
        semanticId: custom.semanticId || `urn:custom:${custom.idShort}:1:0`,
        description: custom.description,
        category: 'Custom',
        elements: [],
      });
    }
    handleClose();
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    setTimeout(
      () => setChatMessages((prev) => [...prev, { role: 'bot', text: getChatResponse(msg) }]),
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
            Aggiungi Submodel
          </Typography>
          <Typography variant="caption" color="text.disabled" fontFamily="monospace">
            Catalogo IDTA o custom
          </Typography>
        </Box>
        <Box flexGrow={1} />
        <IconButton size="small" onClick={handleClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ── Body: left panel + chatbot ── */}
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
          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab value="catalog" label="Catalogo IDTA" />
            <Tab value="custom" label="Custom" />
          </Tabs>

          {tab === 'catalog' ? (
            <>
              {/* Search + category chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" p={1.5} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Cerca idShort, semanticId…"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
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
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {categories.map((c) => (
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

              {/* Catalog list */}
              <Box flex={1} overflow="auto" px={2} pb={2}>
                {filtered.map((sm) => (
                  <Paper
                    key={sm.id}
                    variant="outlined"
                    onClick={() => setSelected(sm.id)}
                    sx={{
                      p: 1.75,
                      mb: 0.75,
                      cursor: 'pointer',
                      borderColor: selected === sm.id ? 'primary.main' : 'divider',
                      bgcolor: selected === sm.id ? 'action.selected' : 'background.paper',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">{sm.idShort}</Typography>
                        <Chip
                          label={sm.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace', fontSize: 9 }}
                        />
                      </Stack>
                      {selected === sm.id && <CheckRounded color="primary" fontSize="small" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      {sm.description}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      display="block"
                      mt={0.75}
                      fontFamily="monospace"
                    >
                      {sm.semanticId}
                    </Typography>
                  </Paper>
                ))}
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
                onChange={(e) => setCustom((p) => ({ ...p, idShort: e.target.value }))}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
              />
              <TextField
                label="semanticId"
                size="small"
                fullWidth
                value={custom.semanticId}
                placeholder="urn:org:submodel:Name:1:0"
                onChange={(e) => setCustom((p) => ({ ...p, semanticId: e.target.value }))}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
              />
              <TextField
                label="Descrizione"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={custom.description}
                onChange={(e) => setCustom((p) => ({ ...p, description: e.target.value }))}
              />
            </Stack>
          )}

          {/* Action footer */}
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1}
            p={1.5}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            <Button onClick={handleClose}>Annulla</Button>
            <Button
              variant="contained"
              disabled={!canAdd}
              startIcon={<AddRounded />}
              onClick={handleAdd}
            >
              Aggiungi
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
          {/* Chatbot header */}
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
                AAS Assistant
              </Typography>
              <Typography variant="caption" color="primary.main" fontFamily="monospace">
                online
              </Typography>
            </Box>
          </Stack>

          {/* Messages */}
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
                    borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
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

          {/* Chat input */}
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
              placeholder="Chiedi aiuto…"
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
