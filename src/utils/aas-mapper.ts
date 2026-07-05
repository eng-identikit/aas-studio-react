// ─────────────────────────────────────────────────────────────────────────────
// Standard AAS (IDTA Part 1 JSON) → AAS Studio internal model.
//
// The inverse direction (internal → standard) lives in `aas-builder.ts`. Keep the
// two in sync: this is the single place that decodes shells/submodels coming from
// a remote AAS server (or an imported AASX) into the editor's working shape.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AASModel,
  AssetKind,
  ElementQualifier,
  ElementType,
  SubmodelElement,
  SubmodelTemplate,
  XsdValueType,
} from '@/context/AASContext';

type Json = Record<string, unknown>;

const ELEMENT_TYPES: ReadonlySet<string> = new Set<ElementType>([
  'Property',
  'MultiLanguageProperty',
  'Range',
  'File',
  'Blob',
  'ReferenceElement',
  'RelationshipElement',
  'AnnotatedRelationshipElement',
  'Entity',
  'Operation',
  'Capability',
  'BasicEventElement',
  'SubmodelElementCollection',
  'SubmodelElementList',
]);

function asElementType(modelType: unknown): ElementType {
  const s = String(modelType ?? '');
  return ELEMENT_TYPES.has(s) ? (s as ElementType) : 'Property';
}

/** Pull the first key value out of an AAS Reference object. */
export function extractSemanticId(semanticId: unknown): string {
  if (!semanticId || typeof semanticId !== 'object') return '';
  const obj = semanticId as Json;
  const keys = (obj.keys ?? obj.Keys) as Array<Record<string, string>> | undefined;
  return keys?.[0]?.value ?? '';
}

/** Collapse an AAS multi-language description array to a single string. */
export function extractDescription(description: unknown): string {
  if (Array.isArray(description)) {
    const first = description.find((d) => d && typeof d === 'object' && 'text' in d) as Json | undefined;
    return first ? String(first.text ?? '') : '';
  }
  return typeof description === 'string' ? description : '';
}

/** AAS MultiLanguageProperty value ([{language,text}]) → internal Record<lang,text>. */
function mapMlpValue(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const entry of value) {
    if (entry && typeof entry === 'object') {
      const e = entry as Json;
      const lang = e.language != null ? String(e.language) : '';
      if (lang) out[lang] = String(e.text ?? '');
    }
  }
  return out;
}

/** Qualifier values that make an element mandatory per SMT cardinality. */
const REQUIRED_CARDINALITIES = new Set(['One', 'OneToMany']);

function mapQualifiers(raw: unknown): ElementQualifier[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ElementQualifier[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const j = q as Json;
    out.push({
      type: String(j.type ?? ''),
      valueType: j.valueType as XsdValueType | undefined,
      value: j.value != null ? String(j.value) : undefined,
      kind: j.kind as ElementQualifier['kind'],
    });
  }
  return out.length ? out : undefined;
}

function isRequired(qualifiers: ElementQualifier[] | undefined): boolean {
  return !!qualifiers?.some(
    (q) => /cardinality|multiplicity/i.test(q.type) && REQUIRED_CARDINALITIES.has(q.value ?? ''),
  );
}

function mapNested(list: unknown): SubmodelElement[] {
  return (Array.isArray(list) ? list : [])
    .filter((c): c is Json => !!c && typeof c === 'object' && 'modelType' in (c as Json))
    .map(mapElement);
}

/** Operation variables come wrapped: [{ value: <element> }]. */
function mapOperationVars(list: unknown): SubmodelElement[] | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const els = list
    .map((v) => (v && typeof v === 'object' ? (v as Json).value : undefined))
    .filter((c): c is Json => !!c && typeof c === 'object');
  return els.length ? els.map(mapElement) : undefined;
}

export function mapElement(raw: unknown): SubmodelElement {
  const el = (raw ?? {}) as Json;
  const type = asElementType(el.modelType);
  const qualifiers = mapQualifiers(el.qualifiers);
  const base: SubmodelElement = {
    idShort: String(el.idShort ?? ''),
    type,
    semanticId: extractSemanticId(el.semanticId),
    required: isRequired(qualifiers),
  };
  const description = extractDescription(el.description);
  if (description) base.description = description;
  if (qualifiers) base.qualifiers = qualifiers;

  switch (type) {
    case 'MultiLanguageProperty':
      return { ...base, value: mapMlpValue(el.value) };
    case 'Range':
      return {
        ...base,
        valueType: (el.valueType as XsdValueType) ?? 'xs:double',
        min: el.min != null ? String(el.min) : '',
        max: el.max != null ? String(el.max) : '',
      };
    case 'SubmodelElementCollection':
    case 'SubmodelElementList':
      // List items may be unnamed (no idShort); still map them as children.
      return { ...base, children: mapNested(el.value) };
    case 'File':
    case 'Blob':
      return {
        ...base,
        contentType: el.contentType != null ? String(el.contentType) : 'application/octet-stream',
        value: typeof el.value === 'string' ? el.value : '',
      };
    case 'ReferenceElement':
      return { ...base, value: extractSemanticId(el.value) };
    case 'RelationshipElement':
    case 'AnnotatedRelationshipElement': {
      const rel: SubmodelElement = {
        ...base,
        first: extractSemanticId(el.first),
        second: extractSemanticId(el.second),
      };
      if (type === 'AnnotatedRelationshipElement') rel.annotations = mapNested(el.annotations);
      return rel;
    }
    case 'Entity':
      return {
        ...base,
        entityType: (el.entityType as SubmodelElement['entityType']) ?? 'SelfManagedEntity',
        globalAssetId: el.globalAssetId != null ? String(el.globalAssetId) : undefined,
        statements: mapNested(el.statements),
      };
    case 'Operation':
      return {
        ...base,
        inputVariables: mapOperationVars(el.inputVariables),
        outputVariables: mapOperationVars(el.outputVariables),
        inoutputVariables: mapOperationVars(el.inoutputVariables),
      };
    case 'Capability':
      return base;
    case 'BasicEventElement':
      return {
        ...base,
        observed: extractSemanticId(el.observed),
        direction: (el.direction as SubmodelElement['direction']) ?? 'output',
        state: (el.state as SubmodelElement['state']) ?? 'on',
        messageTopic: el.messageTopic != null ? String(el.messageTopic) : undefined,
      };
    default:
      return {
        ...base,
        valueType: (el.valueType as XsdValueType) ?? 'xs:string',
        value: el.value != null ? String(el.value) : '',
      };
  }
}

/** One standard AAS Submodel → internal SubmodelTemplate. */
export function mapSubmodel(raw: unknown): SubmodelTemplate {
  const sm = (raw ?? {}) as Json;
  const semanticId = extractSemanticId(sm.semanticId);
  return {
    id: String(sm.id ?? sm.idShort ?? ''),
    idShort: String(sm.idShort ?? ''),
    semanticId,
    description: extractDescription(sm.description),
    category: 'Remote',
    elements: (Array.isArray(sm.submodelElements) ? sm.submodelElements : []).map(mapElement),
  };
}

export interface PulledEnvironment {
  shell: Json;
  submodels: unknown[];
}

/**
 * Map a pulled { shell, submodels } environment to an internal AASModel ready
 * to load into the editor as a working copy. `idPrefix` namespaces the local id
 * so a pulled model doesn't collide with an existing one.
 */
export function mapEnvironmentToModel(
  env: PulledEnvironment,
  opts: { idPrefix?: string } = {},
): AASModel {
  const shell = (env.shell ?? {}) as Json;
  const assetInfo = (shell.assetInformation ?? {}) as Json;
  const shellId = String(shell.id ?? '');
  const localId = `${opts.idPrefix ?? 'remote'}-${shellId || shell.idShort || Date.now()}`;

  return {
    id: localId,
    idShort: String(shell.idShort ?? 'Imported_AAS'),
    assetId: String(assetInfo.globalAssetId ?? ''),
    description: extractDescription(shell.description),
    assetKind: (assetInfo.assetKind as AssetKind) ?? 'Instance',
    versions: [],
    isImported: true,
    dirty: true,
    submodels: (Array.isArray(env.submodels) ? env.submodels : []).map(mapSubmodel),
  };
}
