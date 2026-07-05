import type {
  SubmodelTemplate,
  SubmodelElement,
  SubmodelElementChild,
} from '@/context/AASContext';

// Single source of truth for the AAS environment served by a generated or
// debug server. "Generate Server" prints it as Python literals inside main.py;
// "Run Server" POSTs it as JSON to the aas-server-runner control API. Both
// paths therefore expose exactly the same content.

export interface AasEnvironment {
  info: { idShort: string; version: string };
  shells: Record<string, unknown>;
  submodels: Record<string, unknown>;
  conceptDescriptions: Record<string, unknown>;
}

function elementToJson(el: SubmodelElement | SubmodelElementChild): Record<string, unknown> {
  const out: Record<string, unknown> = {
    modelType: el.type,
    idShort: el.idShort,
  };
  if (el.semanticId) {
    out.semanticId = {
      type: 'ExternalReference',
      keys: [{ type: 'GlobalReference', value: el.semanticId }],
    };
  }
  const extRef = (value: string) => ({
    type: 'ExternalReference',
    keys: [{ type: 'GlobalReference', value }],
  });
  const modelRef = (value: string) => ({
    type: 'ModelReference',
    keys: [{ type: 'Submodel', value }],
  });

  if (el.type === 'Property') {
    if (el.valueType) out.valueType = el.valueType;
    out.value = '';
  } else if (el.type === 'MultiLanguageProperty') {
    out.value = [{ language: 'en', text: '' }];
  } else if (el.type === 'Range') {
    out.valueType = el.valueType ?? 'xs:double';
    if (el.min) out.min = el.min;
    if (el.max) out.max = el.max;
  } else if (el.type === 'SubmodelElementCollection') {
    out.value = (el.children ?? []).map(c => elementToJson(c));
  } else if (el.type === 'SubmodelElementList') {
    const items = (el.children ?? []).map(c => {
      const { idShort: _drop, ...rest } = elementToJson(c);
      return rest;
    });
    out.typeValueListElement = (el.children?.[0]?.type as string) ?? 'Property';
    out.value = items;
  } else if (el.type === 'Operation') {
    out.inputVariables = (el.inputVariables ?? []).map(v => ({ value: elementToJson(v) }));
    out.outputVariables = (el.outputVariables ?? []).map(v => ({ value: elementToJson(v) }));
    out.inoutputVariables = (el.inoutputVariables ?? []).map(v => ({ value: elementToJson(v) }));
  } else if (el.type === 'File' || el.type === 'Blob') {
    out.contentType = el.contentType || 'application/octet-stream';
    if (el.type === 'File') out.value = typeof el.value === 'string' ? el.value : '';
  } else if (el.type === 'ReferenceElement') {
    out.value = typeof el.value === 'string' && el.value ? extRef(el.value) : null;
  } else if (el.type === 'RelationshipElement' || el.type === 'AnnotatedRelationshipElement') {
    out.first = extRef(el.first ?? '');
    out.second = extRef(el.second ?? '');
    if (el.type === 'AnnotatedRelationshipElement') {
      out.annotations = (el.annotations ?? []).map(a => elementToJson(a));
    }
  } else if (el.type === 'Entity') {
    out.entityType = el.entityType ?? 'SelfManagedEntity';
    if (el.entityType !== 'CoManagedEntity' && el.globalAssetId) out.globalAssetId = el.globalAssetId;
    out.statements = (el.statements ?? []).map(s => elementToJson(s));
  } else if (el.type === 'BasicEventElement') {
    out.observed = modelRef(el.observed ?? '');
    out.direction = el.direction ?? 'output';
    out.state = el.state ?? 'on';
    if (el.messageTopic) out.messageTopic = el.messageTopic;
  }
  // Capability: modelType + idShort are all it needs.
  return out;
}

export function buildAasEnvironment(
  aasIdShort: string,
  assetId: string,
  version: string,
  assetKind: string,
  submodels: SubmodelTemplate[],
): AasEnvironment {
  const aasUrn = 'urn:generated:' + aasIdShort;
  const smUrn = (sm: SubmodelTemplate) => 'urn:generated:' + aasIdShort + ':' + sm.idShort;

  const shells: Record<string, unknown> = {
    [aasIdShort]: {
      id: aasUrn,
      idShort: aasIdShort,
      assetInformation: {
        assetKind,
        globalAssetId: assetId,
      },
      submodels: submodels.map(sm => ({
        type: 'ExternalReference',
        keys: [{ type: 'Submodel', value: smUrn(sm) }],
      })),
    },
  };

  const submodelMap: Record<string, unknown> = {};
  for (const sm of submodels) {
    submodelMap[smUrn(sm)] = {
      id: smUrn(sm),
      idShort: sm.idShort,
      description: [{ language: 'en', text: sm.description || sm.idShort }],
      semanticId: {
        type: 'ExternalReference',
        keys: [{ type: 'GlobalReference', value: sm.semanticId }],
      },
      submodelElements: sm.elements.map(e => elementToJson(e)),
    };
  }

  return {
    info: { idShort: aasIdShort, version },
    shells,
    submodels: submodelMap,
    conceptDescriptions: {},
  };
}

// Prints a JSON-safe value as a Python literal (None/True/False instead of
// null/true/false); JSON string escapes are valid in Python string literals.
export function pyLiteral(value: unknown, depth = 0): string {
  const pad = '    '.repeat(depth);
  const inner = '    '.repeat(depth + 1);
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => inner + pyLiteral(v, depth + 1));
    return '[\n' + items.join(',\n') + ',\n' + pad + ']';
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  const items = entries.map(([k, v]) => inner + JSON.stringify(k) + ': ' + pyLiteral(v, depth + 1));
  return '{\n' + items.join(',\n') + ',\n' + pad + '}';
}
