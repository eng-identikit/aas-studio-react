// ─────────────────────────────────────────────────────────────────────────────
// SubmodelElement factory + SMT cardinality presets.
//
// Defaults follow the AAS V3 metamodel (aas-core3.1) so a freshly created
// element serializes to a jsonization-valid node via aas-builder.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { ElementQualifier, ElementType, SubmodelElement } from '@/context/AASContext';

export type ElementTypeGroup = 'data' | 'references' | 'containers' | 'behavior';

/** All 14 SubmodelElement types, grouped for the type picker. */
export const ELEMENT_TYPE_OPTIONS: ReadonlyArray<{ type: ElementType; group: ElementTypeGroup }> = [
  { type: 'Property', group: 'data' },
  { type: 'MultiLanguageProperty', group: 'data' },
  { type: 'Range', group: 'data' },
  { type: 'File', group: 'data' },
  { type: 'Blob', group: 'data' },
  { type: 'ReferenceElement', group: 'references' },
  { type: 'RelationshipElement', group: 'references' },
  { type: 'AnnotatedRelationshipElement', group: 'references' },
  { type: 'SubmodelElementCollection', group: 'containers' },
  { type: 'SubmodelElementList', group: 'containers' },
  { type: 'Entity', group: 'containers' },
  { type: 'Operation', group: 'behavior' },
  { type: 'Capability', group: 'behavior' },
  { type: 'BasicEventElement', group: 'behavior' },
];

/** SMT cardinality (IDTA 2001): drives the internal `required` flag. */
export const CARDINALITY_VALUES = ['One', 'ZeroToOne', 'ZeroToMany', 'OneToMany'] as const;
export type Cardinality = (typeof CARDINALITY_VALUES)[number];

export const SMT_CARDINALITY_TYPE = 'SMT/Cardinality';

export function cardinalityQualifier(value: Cardinality): ElementQualifier {
  // No explicit `kind`: the default (ConceptQualifier) keeps an Instance
  // submodel valid — kind=TemplateQualifier would violate AASd-129.
  return { type: SMT_CARDINALITY_TYPE, valueType: 'xs:string', value };
}

export function cardinalityOf(el: Pick<SubmodelElement, 'qualifiers'>): Cardinality | '' {
  const q = el.qualifiers?.find((x) => /cardinality|multiplicity/i.test(x.type));
  return (CARDINALITY_VALUES as readonly string[]).includes(q?.value ?? '') ? (q!.value as Cardinality) : '';
}

export function isRequiredCardinality(c: Cardinality | ''): boolean {
  return c === 'One' || c === 'OneToMany';
}

/** New element with metamodel-valid defaults for the given type. */
export function createElement(type: ElementType, idShort = ''): SubmodelElement {
  const base: SubmodelElement = { idShort, type, semanticId: '', required: false };
  switch (type) {
    case 'Property':
      return { ...base, valueType: 'xs:string', value: '' };
    case 'MultiLanguageProperty':
      return { ...base, value: {} };
    case 'Range':
      return { ...base, valueType: 'xs:double', min: '', max: '' };
    case 'File':
      return { ...base, contentType: 'application/octet-stream', value: '' };
    case 'Blob':
      return { ...base, contentType: 'application/octet-stream' };
    case 'ReferenceElement':
      return { ...base, value: '' };
    case 'RelationshipElement':
      return { ...base, first: '', second: '' };
    case 'AnnotatedRelationshipElement':
      return { ...base, first: '', second: '', annotations: [] };
    case 'Entity':
      return { ...base, entityType: 'SelfManagedEntity', globalAssetId: '', statements: [] };
    case 'Operation':
      return { ...base, inputVariables: [], outputVariables: [], inoutputVariables: [] };
    case 'Capability':
      return base;
    case 'BasicEventElement':
      return { ...base, observed: '', direction: 'output', state: 'on', messageTopic: '' };
    case 'SubmodelElementCollection':
    case 'SubmodelElementList':
      return { ...base, children: [] };
  }
}
