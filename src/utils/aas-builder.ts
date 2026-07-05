import { SubmodelTemplate, AssetKind, SubmodelElement, ElementQualifier } from '@/context/AASContext';

export interface IDTAReference {
  type: string;
  keys: Array<{ type: string; value: string }>;
}

export interface IDTAQualifier {
  type: string;
  valueType: string;
  value?: string;
  kind?: string;
}

export interface IDTASubmodelElement {
  idShort?: string;
  modelType: string;
  semanticId?: IDTAReference;
  description?: Array<{ language: string; text: string }>;
  valueType?: string;
  value?: string | unknown[] | IDTAReference;
  contentType?: string;
  min?: string;
  max?: string;
  first?: IDTAReference;
  second?: IDTAReference;
  annotations?: unknown[];
  entityType?: string;
  globalAssetId?: string;
  statements?: unknown[];
  direction?: string;
  state?: string;
  messageTopic?: string;
  observed?: IDTAReference;
  inputVariables?: unknown[];
  outputVariables?: unknown[];
  inoutputVariables?: unknown[];
  qualifiers?: IDTAQualifier[];
  typeValueListElement?: string;
}

export interface IDTASubmodel {
  modelType: 'Submodel';
  id: string;
  idShort: string;
  semanticId?: IDTAReference;
  description?: Array<{ language: string; text: string }>;
  submodelElements?: IDTASubmodelElement[];
}

export interface IDTAShell {
  modelType: 'AssetAdministrationShell';
  id: string;
  idShort: string;
  description?: Array<{ language: string; text: string }>;
  assetInformation: {
    assetKind: AssetKind;
    globalAssetId: string;
  };
  submodels?: IDTAReference[];
}

export interface IDTAEnvironment {
  assetAdministrationShells: IDTAShell[];
  submodels?: IDTASubmodel[];
  conceptDescriptions?: unknown[];
}

function buildReference(value: string): IDTAReference {
  return {
    type: 'ExternalReference',
    keys: [{ type: 'GlobalReference', value }],
  };
}

/** BasicEventElement.observed must be a ModelReference; the first key of a
 * ModelReference must be an Identifiable (AASd-123), so key type is Submodel. */
function buildModelReference(value: string): IDTAReference {
  return {
    type: 'ModelReference',
    keys: [{ type: 'Submodel', value }],
  };
}

function buildQualifiers(qualifiers: ElementQualifier[] | undefined): IDTAQualifier[] | undefined {
  if (!qualifiers?.length) return undefined;
  return qualifiers
    .filter((q) => q.type)
    .map((q) => ({
      type: q.type,
      valueType: q.valueType ?? 'xs:string',
      ...(q.value != null && q.value !== '' ? { value: q.value } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    }));
}

/** Operation variables are wrapped: [{ value: <element> }]. */
function buildOperationVars(els: SubmodelElement[] | undefined): unknown[] | undefined {
  if (!els?.length) return undefined;
  return els.map((e) => ({ value: mapSubmodelElement(e) }));
}

function mapSubmodelElement(el: SubmodelElement): IDTASubmodelElement {
  const base: Partial<IDTASubmodelElement> = {
    idShort: el.idShort,
    semanticId: el.semanticId ? buildReference(el.semanticId) : undefined,
  };
  if (el.description) base.description = [{ language: 'en', text: el.description }];
  const qualifiers = buildQualifiers(el.qualifiers);
  if (qualifiers) base.qualifiers = qualifiers;

  switch (el.type) {
    case 'Property':
      return {
        ...base,
        modelType: 'Property',
        valueType: el.valueType || 'xs:string',
        value: el.value !== undefined && el.value !== '' ? String(el.value) : undefined,
      };
    case 'MultiLanguageProperty': {
      // Omit when MLP value is empty
      const langs = el.value && typeof el.value === 'object' && !Array.isArray(el.value)
        ? Object.entries(el.value as Record<string, string>)
            .filter(([, text]) => typeof text === 'string' && text.trim() !== '')
            .map(([language, text]) => ({ language, text }))
        : [];
      return {
        ...base,
        modelType: 'MultiLanguageProperty',
        ...(langs.length ? { value: langs } : {}),
      };
    }
    case 'SubmodelElementCollection': {
      const children = (el.children || []).map((child) => mapSubmodelElement(child as SubmodelElement));
      return {
        ...base,
        modelType: 'SubmodelElementCollection',
        ...(children.length ? { value: children } : {}),
      };
    }
    case 'SubmodelElementList': {
      // Items have no idShort (AASd-120). typeValueListElement is required; derive
      // it from the items, falling back to Property for an empty list.
      const items = (el.children || []).map((child) => {
        const { idShort: _drop, ...rest } = mapSubmodelElement(child as SubmodelElement);
        return rest;
      });
      return {
        ...base,
        modelType: 'SubmodelElementList',
        typeValueListElement: items[0]?.modelType ?? 'Property',
        ...(items.length ? { value: items } : {}),
      };
    }
    case 'Range':
      return {
        ...base,
        modelType: 'Range',
        valueType: el.valueType || 'xs:double',
        ...(el.min !== undefined && el.min !== '' ? { min: el.min } : {}),
        ...(el.max !== undefined && el.max !== '' ? { max: el.max } : {}),
      };
    case 'File':
      return {
        ...base,
        modelType: 'File',
        value: typeof el.value === 'string' ? el.value : '',
        contentType: el.contentType || 'application/octet-stream',
      };
    case 'Blob':
      return {
        ...base,
        modelType: 'Blob',
        contentType: el.contentType || 'application/octet-stream',
        ...(typeof el.value === 'string' && el.value !== '' ? { value: el.value } : {}),
      };
    case 'ReferenceElement':
      return {
        ...base,
        modelType: 'ReferenceElement',
        ...(typeof el.value === 'string' && el.value !== '' ? { value: buildReference(el.value) } : {}),
      };
    case 'RelationshipElement':
    case 'AnnotatedRelationshipElement': {
      // first/second are plain References: an ExternalReference is always
      // valid, while a single-key ModelReference would violate AASd-123.
      const rel: IDTASubmodelElement = {
        ...base,
        modelType: el.type,
        first: buildReference(el.first ?? ''),
        second: buildReference(el.second ?? ''),
      };
      if (el.type === 'AnnotatedRelationshipElement' && el.annotations?.length) {
        rel.annotations = el.annotations.map(mapSubmodelElement);
      }
      return rel;
    }
    case 'Entity':
      return {
        ...base,
        modelType: 'Entity',
        entityType: el.entityType ?? 'SelfManagedEntity',
        ...(el.entityType !== 'CoManagedEntity' && el.globalAssetId ? { globalAssetId: el.globalAssetId } : {}),
        ...(el.statements?.length ? { statements: el.statements.map(mapSubmodelElement) } : {}),
      };
    case 'Operation':
      return {
        ...base,
        modelType: 'Operation',
        ...(buildOperationVars(el.inputVariables) ? { inputVariables: buildOperationVars(el.inputVariables) } : {}),
        ...(buildOperationVars(el.outputVariables) ? { outputVariables: buildOperationVars(el.outputVariables) } : {}),
        ...(buildOperationVars(el.inoutputVariables) ? { inoutputVariables: buildOperationVars(el.inoutputVariables) } : {}),
      };
    case 'Capability':
      return {
        ...base,
        modelType: 'Capability',
      };
    case 'BasicEventElement':
      return {
        ...base,
        modelType: 'BasicEventElement',
        observed: buildModelReference(el.observed ?? ''),
        direction: el.direction ?? 'output',
        state: el.state ?? 'on',
        ...(el.messageTopic ? { messageTopic: el.messageTopic } : {}),
      };
    default:
      return {
        ...base,
        modelType: el.type,
      };
  }
}

export function buildAasEnvironment(
  aasIdShort: string,
  aasAssetId: string,
  aasDescription: string,
  assetKind: AssetKind,
  submodels: SubmodelTemplate[]
): IDTAEnvironment {
  const mappedSubmodels: IDTASubmodel[] = submodels.map((sm) => {
    const isStandardId = sm.id.startsWith('urn:') || sm.id.startsWith('https:');
    const submodelElements = (sm.elements || []).map(mapSubmodelElement).filter(Boolean) as IDTASubmodelElement[];
    return {
      modelType: 'Submodel',
      id: isStandardId ? sm.id : `https://aas-studio.local/submodels/${sm.id}`,
      idShort: sm.idShort,
      semanticId: sm.semanticId ? buildReference(sm.semanticId) : undefined,
      description: sm.description ? [{ language: 'en', text: sm.description }] : undefined,
      ...(submodelElements.length ? { submodelElements } : {}),
    };
  });

  const submodelRefs: IDTAReference[] = mappedSubmodels.map((sm) => ({
    type: 'ModelReference',
    keys: [{ type: 'Submodel', value: sm.id }],
  }));

  const shell: IDTAShell = {
    modelType: 'AssetAdministrationShell',
    id: `https://aas-studio.local/shells/${aasIdShort || 'default'}`,
    idShort: aasIdShort,
    description: aasDescription ? [{ language: 'en', text: aasDescription }] : undefined,
    assetInformation: {
      assetKind: assetKind || 'Instance',
      globalAssetId: aasAssetId || 'https://aas-studio.local/assets/default',
    },
    ...(submodelRefs.length ? { submodels: submodelRefs } : {}),
  };

  return {
    assetAdministrationShells: [shell],
    ...(mappedSubmodels.length ? { submodels: mappedSubmodels } : {}),
  };
}
