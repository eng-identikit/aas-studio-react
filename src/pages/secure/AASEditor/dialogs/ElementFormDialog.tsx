import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AddRounded, CloseRounded, DeleteOutlineRounded, TuneRounded } from '@mui/icons-material';

import type { ElementType, SubmodelElement, XsdValueType } from '@/context/AASContext';
import {
  CARDINALITY_VALUES,
  ELEMENT_TYPE_OPTIONS,
  cardinalityOf,
  cardinalityQualifier,
  createElement,
  isRequiredCardinality,
  type Cardinality,
  type ElementTypeGroup,
} from '@/utils/element-factory';

const XSD_TYPES: XsdValueType[] = [
  'xs:string', 'xs:int', 'xs:double', 'xs:float', 'xs:boolean', 'xs:date',
  'xs:dateTime', 'xs:long', 'xs:short', 'xs:byte', 'xs:anyURI', 'xs:duration', 'xs:decimal',
];

const ID_SHORT_RE = /^[a-zA-Z_]\w*$/;
const MLP_LANGS = ['en', 'it', 'de'] as const;

export interface ElementFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** Element being edited (edit mode) — never mutated in place. */
  initial?: SubmodelElement;
  /** Parent is a SubmodelElementList: items must not carry an idShort (AASd-120). */
  isListItem?: boolean;
  onSave: (el: SubmodelElement) => void;
}

// ── Sub-element mini list (Operation variables, Entity statements, ARE annotations) ──

function SubElementList({
  label, items, onChange,
}: {
  label: string;
  items: SubmodelElement[];
  onChange: (items: SubmodelElement[]) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [vt, setVt] = useState<XsdValueType>('xs:string');

  const add = () => {
    if (!name.trim() || !ID_SHORT_RE.test(name.trim())) return;
    onChange([...items, { ...createElement('Property', name.trim()), valueType: vt }]);
    setName('');
  };

  return (
    <Box>
      <Typography variant="overline" color="text.disabled">{label}</Typography>
      {items.map((v, i) => (
        <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ py: 0.25 }}>
          <Typography variant="caption" fontFamily="monospace" flex={1} noWrap>
            {v.idShort || `[${i}]`} <Box component="span" color="text.disabled">: {v.type}{v.valueType ? ` (${v.valueType})` : ''}</Box>
          </Typography>
          <IconButton size="small" onClick={() => onChange(items.filter((_, x) => x !== i))}
            aria-label={t('editor.elementForm.removeSubElement', { name: v.idShort || i })}>
            <DeleteOutlineRounded sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
        <TextField
          size="small" value={name} placeholder="idShort"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          error={!!name && !ID_SHORT_RE.test(name)}
          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
          sx={{ flex: 1 }}
        />
        <Select size="small" value={vt} onChange={(e) => setVt(e.target.value as XsdValueType)}
          sx={{ fontFamily: 'monospace', fontSize: 11, width: 130 }}>
          {XSD_TYPES.map(x => <MenuItem key={x} value={x} sx={{ fontFamily: 'monospace', fontSize: 11 }}>{x}</MenuItem>)}
        </Select>
        <Button size="small" startIcon={<AddRounded />} onClick={add} disabled={!name.trim() || !ID_SHORT_RE.test(name.trim())}>
          {t('common.buttons.add')}
        </Button>
      </Stack>
    </Box>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

export default function ElementFormDialog({
  open, onClose, mode, initial, isListItem = false, onSave,
}: ElementFormDialogProps) {
  const { t } = useTranslation();
  const [el, setEl] = useState<SubmodelElement>(() => createElement('Property'));
  const [cardinality, setCardinality] = useState<Cardinality | ''>('');

  useEffect(() => {
    if (!open) return;
    const base = initial ? (JSON.parse(JSON.stringify(initial)) as SubmodelElement) : createElement('Property');
    setEl(base);
    setCardinality(initial ? cardinalityOf(initial) : '');
  }, [open, initial]);

  const set = (patch: Partial<SubmodelElement>) => setEl(prev => ({ ...prev, ...patch }));

  const changeType = (type: ElementType) => {
    // Fresh element of the new type, keeping the identity fields already typed.
    const next = createElement(type, el.idShort);
    setEl({ ...next, semanticId: el.semanticId, description: el.description });
  };

  const idShortInvalid = !isListItem && (!el.idShort.trim() || !ID_SHORT_RE.test(el.idShort.trim()));
  const canSave = isListItem ? true : !idShortInvalid;

  const groups = useMemo(() => {
    const byGroup = new Map<ElementTypeGroup, ElementType[]>();
    for (const o of ELEMENT_TYPE_OPTIONS) {
      byGroup.set(o.group, [...(byGroup.get(o.group) ?? []), o.type]);
    }
    return byGroup;
  }, []);

  const handleSave = () => {
    const out: SubmodelElement = { ...el, idShort: isListItem ? '' : el.idShort.trim() };
    // Cardinality → SMT qualifier + required flag.
    const others = (out.qualifiers ?? []).filter(q => !/cardinality|multiplicity/i.test(q.type));
    out.qualifiers = cardinality ? [...others, cardinalityQualifier(cardinality)] : (others.length ? others : undefined);
    out.required = isRequiredCardinality(cardinality);
    onSave(out);
    onClose();
  };

  const mlv = typeof el.value === 'object' && el.value !== null ? (el.value as Record<string, string>) : {};

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '88vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TuneRounded color="primary" />
        {mode === 'create' ? t('editor.elementForm.titleCreate') : t('editor.elementForm.titleEdit', { name: initial?.idShort || '' })}
        <Box flexGrow={1} />
        <IconButton size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={0.5}>
          {/* Type (locked in edit mode: switching type would drop the payload) */}
          <FormControl size="small" fullWidth disabled={mode === 'edit'}>
            <InputLabel id="elf-type-label">{t('editor.elementForm.type')}</InputLabel>
            <Select
              labelId="elf-type-label"
              value={el.type}
              label={t('editor.elementForm.type')}
              onChange={(e) => changeType(e.target.value as ElementType)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 380 } } }}
            >
              {[...groups.entries()].flatMap(([group, types]) => [
                <ListSubheader key={`h-${group}`}>{t(`editor.elementForm.group.${group}`)}</ListSubheader>,
                ...types.map(type => (
                  <MenuItem key={type} value={type} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{type}</MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          {isListItem ? (
            <Typography variant="caption" color="text.disabled">
              {t('editor.elementForm.listItemNote')}
            </Typography>
          ) : (
            <TextField
              size="small" fullWidth required
              label="idShort"
              value={el.idShort}
              onChange={(e) => set({ idShort: e.target.value })}
              error={!!el.idShort && idShortInvalid}
              helperText={el.idShort && idShortInvalid ? t('editor.elementForm.idShortInvalid') : ' '}
              slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            />
          )}

          <TextField
            size="small" fullWidth label="semanticId"
            value={el.semanticId ?? ''}
            onChange={(e) => set({ semanticId: e.target.value })}
            placeholder="0173-1#02-AAO677#002 / https://…"
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          />

          <TextField
            size="small" fullWidth multiline minRows={1}
            label={t('editor.elementForm.description')}
            value={el.description ?? ''}
            onChange={(e) => set({ description: e.target.value })}
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="elf-card-label">{t('editor.elementForm.cardinality')}</InputLabel>
            <Select
              labelId="elf-card-label"
              value={cardinality}
              label={t('editor.elementForm.cardinality')}
              onChange={(e) => setCardinality(e.target.value as Cardinality | '')}
            >
              <MenuItem value="">{t('editor.elementForm.cardinalityNone')}</MenuItem>
              {CARDINALITY_VALUES.map(c => (
                <MenuItem key={c} value={c} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {c}{isRequiredCardinality(c) ? ' — required' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* ── Type-specific fields ── */}
          {el.type === 'Property' && (
            <Stack direction="row" spacing={1.5}>
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel id="elf-vt-label">{t('editor.elementForm.valueType')}</InputLabel>
                <Select labelId="elf-vt-label" value={el.valueType ?? 'xs:string'} label={t('editor.elementForm.valueType')}
                  onChange={(e) => set({ valueType: e.target.value as XsdValueType })}
                  sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {XSD_TYPES.map(x => <MenuItem key={x} value={x} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{x}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" fullWidth label={t('editor.elementForm.value')}
                value={typeof el.value === 'string' ? el.value : ''}
                onChange={(e) => set({ value: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
            </Stack>
          )}

          {el.type === 'MultiLanguageProperty' && (
            <Stack spacing={1}>
              {MLP_LANGS.map(lang => (
                <TextField key={lang} size="small" fullWidth label={lang}
                  value={mlv[lang] ?? ''}
                  onChange={(e) => set({ value: { ...mlv, [lang]: e.target.value } })} />
              ))}
            </Stack>
          )}

          {el.type === 'Range' && (
            <Stack direction="row" spacing={1.5}>
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel id="elf-rvt-label">{t('editor.elementForm.valueType')}</InputLabel>
                <Select labelId="elf-rvt-label" value={el.valueType ?? 'xs:double'} label={t('editor.elementForm.valueType')}
                  onChange={(e) => set({ valueType: e.target.value as XsdValueType })}
                  sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {XSD_TYPES.map(x => <MenuItem key={x} value={x} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{x}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="min" value={el.min ?? ''} onChange={(e) => set({ min: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              <TextField size="small" label="max" value={el.max ?? ''} onChange={(e) => set({ max: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
            </Stack>
          )}

          {(el.type === 'File' || el.type === 'Blob') && (
            <Stack spacing={1.5}>
              <TextField size="small" fullWidth label="contentType" value={el.contentType ?? ''}
                onChange={(e) => set({ contentType: e.target.value })}
                placeholder="application/pdf"
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              {el.type === 'File' && (
                <TextField size="small" fullWidth label={t('editor.elementForm.filePath')}
                  value={typeof el.value === 'string' ? el.value : ''}
                  onChange={(e) => set({ value: e.target.value })}
                  placeholder="/aasx/docs/manual.pdf"
                  slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              )}
            </Stack>
          )}

          {el.type === 'ReferenceElement' && (
            <TextField size="small" fullWidth label={t('editor.elementForm.referenceTarget')}
              value={typeof el.value === 'string' ? el.value : ''}
              onChange={(e) => set({ value: e.target.value })}
              placeholder="urn:… / https://…"
              slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
          )}

          {(el.type === 'RelationshipElement' || el.type === 'AnnotatedRelationshipElement') && (
            <Stack spacing={1.5}>
              <TextField size="small" fullWidth required label="first" value={el.first ?? ''}
                onChange={(e) => set({ first: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              <TextField size="small" fullWidth required label="second" value={el.second ?? ''}
                onChange={(e) => set({ second: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              {el.type === 'AnnotatedRelationshipElement' && (
                <SubElementList label={t('editor.elementForm.annotations')}
                  items={el.annotations ?? []}
                  onChange={(annotations) => set({ annotations })} />
              )}
            </Stack>
          )}

          {el.type === 'Entity' && (
            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel id="elf-et-label">entityType</InputLabel>
                <Select labelId="elf-et-label" value={el.entityType ?? 'SelfManagedEntity'} label="entityType"
                  onChange={(e) => set({ entityType: e.target.value as SubmodelElement['entityType'] })}>
                  <MenuItem value="SelfManagedEntity">SelfManagedEntity</MenuItem>
                  <MenuItem value="CoManagedEntity">CoManagedEntity</MenuItem>
                </Select>
              </FormControl>
              {el.entityType !== 'CoManagedEntity' && (
                <TextField size="small" fullWidth label="globalAssetId" value={el.globalAssetId ?? ''}
                  onChange={(e) => set({ globalAssetId: e.target.value })}
                  slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              )}
              <SubElementList label={t('editor.elementForm.statements')}
                items={el.statements ?? []}
                onChange={(statements) => set({ statements })} />
            </Stack>
          )}

          {el.type === 'Operation' && (
            <Stack spacing={2}>
              <SubElementList label={t('editor.elementForm.inputVars')}
                items={el.inputVariables ?? []}
                onChange={(inputVariables) => set({ inputVariables })} />
              <SubElementList label={t('editor.elementForm.outputVars')}
                items={el.outputVariables ?? []}
                onChange={(outputVariables) => set({ outputVariables })} />
              <SubElementList label={t('editor.elementForm.inoutputVars')}
                items={el.inoutputVariables ?? []}
                onChange={(inoutputVariables) => set({ inoutputVariables })} />
            </Stack>
          )}

          {el.type === 'BasicEventElement' && (
            <Stack spacing={1.5}>
              <TextField size="small" fullWidth required label="observed" value={el.observed ?? ''}
                onChange={(e) => set({ observed: e.target.value })}
                placeholder={t('editor.elementForm.observedPlaceholder')}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
              <Stack direction="row" spacing={1.5}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="elf-dir-label">direction</InputLabel>
                  <Select labelId="elf-dir-label" value={el.direction ?? 'output'} label="direction"
                    onChange={(e) => set({ direction: e.target.value as SubmodelElement['direction'] })}>
                    <MenuItem value="input">input</MenuItem>
                    <MenuItem value="output">output</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="elf-state-label">state</InputLabel>
                  <Select labelId="elf-state-label" value={el.state ?? 'on'} label="state"
                    onChange={(e) => set({ state: e.target.value as SubmodelElement['state'] })}>
                    <MenuItem value="on">on</MenuItem>
                    <MenuItem value="off">off</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField size="small" fullWidth label="messageTopic" value={el.messageTopic ?? ''}
                onChange={(e) => set({ messageTopic: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
            </Stack>
          )}

          {(el.type === 'SubmodelElementCollection' || el.type === 'SubmodelElementList') && (
            <Typography variant="caption" color="text.disabled">
              {t('editor.elementForm.containerNote')}
            </Typography>
          )}

          {el.type === 'Capability' && (
            <Typography variant="caption" color="text.disabled">
              {t('editor.elementForm.capabilityNote')}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.buttons.cancel')}</Button>
        <Tooltip title={canSave ? '' : t('editor.elementForm.idShortInvalid')}>
          <span>
            <Button variant="contained" disableElevation onClick={handleSave} disabled={!canSave}>
              {mode === 'create' ? t('common.buttons.add') : t('common.buttons.save')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
