import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ═══════════════════════════════════
// TYPES
// ═══════════════════════════════════

export type VersionStatus = 'Draft' | 'Active' | 'Deprecated';
export type AssetKind = 'Instance' | 'Type';
export type ChangeType = 'added' | 'modified' | 'removed';
export type ElementType =
  | 'Property'
  | 'MultiLanguageProperty'
  | 'SubmodelElementCollection'
  | 'Operation'
  | 'File'
  | 'Blob'
  | 'ReferenceElement';
export type XsdValueType =
  | 'xs:string'
  | 'xs:int'
  | 'xs:double'
  | 'xs:float'
  | 'xs:boolean'
  | 'xs:date'
  | 'xs:dateTime'
  | 'xs:long'
  | 'xs:short'
  | 'xs:byte'
  | 'xs:anyURI'
  | 'xs:duration'
  | 'xs:decimal';

export interface ChangeDetail {
  type: ChangeType;
  target: string;
  name: string;
  desc: string;
}

export interface AASVersion {
  version: string;
  revision: string;
  date: string;
  status: VersionStatus;
  author: string;
  changes: string;
  details: ChangeDetail[];
}

export interface AASModel {
  id: string;
  idShort: string;
  assetId: string;
  description: string;
  assetKind: AssetKind;
  versions: AASVersion[];
  submodels: SubmodelTemplate[];
  isImported?: boolean;
  documentId?: number;
}

export interface SubmodelElementChild {
  idShort: string;
  type: ElementType;
  valueType?: XsdValueType;
  semanticId?: string;
  required: boolean;
}

export interface SubmodelElement {
  idShort: string;
  type: ElementType;
  valueType?: XsdValueType;
  semanticId?: string;
  required: boolean;
  value?: string | Record<string, string>;
  contentType?: string;
  children?: SubmodelElementChild[];
}

export interface SubmodelTemplate {
  id: string;
  idShort: string;
  semanticId: string;
  description: string;
  category: string;
  elements: SubmodelElement[];
}

export interface ValidationFinding {
  path: string;
  msg: string;
  rule: string;
}

export interface ValidationResult {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
  valid: boolean;
}

// ═══════════════════════════════════
// SUBMODEL CATALOG
// ═══════════════════════════════════

export const SM_CATALOG: SubmodelTemplate[] = [
  {
    id: 'smt-nameplate', idShort: 'Nameplate',
    semanticId: 'urn:idta:aas:submodel:Nameplate:1:0',
    description: 'Identificazione produttore IEC 61406', category: 'Identification',
    elements: [
      { idShort: 'ManufacturerName', type: 'MultiLanguageProperty', semanticId: '0173-1#02-AAO677#002', required: true },
      { idShort: 'ManufacturerProductDesignation', type: 'MultiLanguageProperty', semanticId: '0173-1#02-AAW338#001', required: true },
      { idShort: 'SerialNumber', type: 'Property', valueType: 'xs:string', semanticId: '0173-1#02-AAM556#002', required: false },
      { idShort: 'YearOfConstruction', type: 'Property', valueType: 'xs:string', semanticId: '0173-1#02-AAP906#001', required: false },
    ],
  },
  {
    id: 'smt-identification', idShort: 'Identification',
    semanticId: 'urn:idta:aas:submodel:Identification:1:0',
    description: 'Dati identificazione ECLASS', category: 'Identification',
    elements: [
      { idShort: 'ManufacturerId', type: 'Property', valueType: 'xs:string', semanticId: '0173-1#02-AAO677#002', required: true },
      { idShort: 'AssetId', type: 'Property', valueType: 'xs:string', semanticId: 'urn:idta:id:AssetId', required: true },
      { idShort: 'ProductType', type: 'Property', valueType: 'xs:string', semanticId: '0173-1#02-AAO057#002', required: false },
    ],
  },
  {
    id: 'smt-techdata', idShort: 'TechnicalData',
    semanticId: 'urn:idta:aas:submodel:TechnicalData:1:2',
    description: 'Proprietà tecniche IEC 61360', category: 'Technical',
    elements: [
      {
        idShort: 'GeneralInformation', type: 'SubmodelElementCollection', semanticId: 'urn:idta:td:GeneralInfo', required: true,
        children: [
          { idShort: 'ManufacturerName', type: 'Property', valueType: 'xs:string', required: true },
          { idShort: 'ProductArticleNumber', type: 'Property', valueType: 'xs:string', required: false },
        ],
      },
      { idShort: 'TechnicalProperties', type: 'SubmodelElementCollection', semanticId: 'urn:idta:td:TechProps', required: true, children: [] },
    ],
  },
  {
    id: 'smt-documentation', idShort: 'HandoverDocumentation',
    semanticId: 'urn:idta:aas:submodel:HandoverDocumentation:1:2',
    description: 'Documentazione tecnica', category: 'Documentation',
    elements: [
      {
        idShort: 'DocumentationCollection', type: 'SubmodelElementCollection', semanticId: 'urn:idta:doc:Collection', required: true,
        children: [
          { idShort: 'DocumentId', type: 'Property', valueType: 'xs:string', required: true },
          { idShort: 'DocumentTitle', type: 'MultiLanguageProperty', required: true },
          { idShort: 'DocumentFile', type: 'File', required: true },
        ],
      },
    ],
  },
  {
    id: 'smt-opdata', idShort: 'OperationalData',
    semanticId: 'urn:idta:aas:submodel:OperationalData:1:0',
    description: 'Dati operativi real-time', category: 'Operational',
    elements: [
      { idShort: 'OperatingHours', type: 'Property', valueType: 'xs:double', semanticId: '0173-1#02-AAV184#001', required: false },
      { idShort: 'CycleCount', type: 'Property', valueType: 'xs:int', semanticId: 'urn:idta:op:CycleCount', required: false },
      { idShort: 'CurrentTemperature', type: 'Property', valueType: 'xs:double', semanticId: '0173-1#02-AAV232#001', required: false },
    ],
  },
  {
    id: 'smt-maintenance', idShort: 'PredictiveMaintenance',
    semanticId: 'urn:idta:aas:submodel:PredictiveMaintenance:1:0',
    description: 'Manutenzione predittiva', category: 'Maintenance',
    elements: [
      {
        idShort: 'MaintenanceSchedule', type: 'SubmodelElementCollection', semanticId: 'urn:idta:pm:Schedule', required: true,
        children: [
          { idShort: 'NextMaintenanceDate', type: 'Property', valueType: 'xs:date', required: true },
          { idShort: 'MaintenanceInterval', type: 'Property', valueType: 'xs:duration', required: false },
        ],
      },
      { idShort: 'RemainingUsefulLife', type: 'Property', valueType: 'xs:double', semanticId: 'urn:idta:pm:RUL', required: false },
      { idShort: 'HealthIndex', type: 'Property', valueType: 'xs:double', semanticId: 'urn:idta:pm:HealthIndex', required: false },
    ],
  },
  {
    id: 'smt-carbonfoot', idShort: 'CarbonFootprint',
    semanticId: 'urn:idta:aas:submodel:CarbonFootprint:1:0',
    description: 'PCF Catena-X', category: 'Sustainability',
    elements: [
      {
        idShort: 'PCFCalculation', type: 'SubmodelElementCollection', semanticId: 'urn:idta:cf:PCF', required: true,
        children: [
          { idShort: 'CO2EquivalentTotal', type: 'Property', valueType: 'xs:double', required: true },
          { idShort: 'ReferenceUnit', type: 'Property', valueType: 'xs:string', required: true },
        ],
      },
    ],
  },
  {
    id: 'smt-bom', idShort: 'BillOfMaterial',
    semanticId: 'urn:idta:aas:submodel:BOM:1:0',
    description: 'Distinta base (BOM)', category: 'Structure',
    elements: [
      {
        idShort: 'BOMEntries', type: 'SubmodelElementCollection', semanticId: 'urn:idta:bom:Entries', required: true,
        children: [
          { idShort: 'PartNumber', type: 'Property', valueType: 'xs:string', required: true },
          { idShort: 'Quantity', type: 'Property', valueType: 'xs:int', required: true },
          { idShort: 'PartReference', type: 'ReferenceElement', required: false },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════
// MOCK DATABASE
// ═══════════════════════════════════

export const MOCK_AAS_DB: AASModel[] = [
  {
    id: 'aas-pump-001',
    idShort: 'AAS_CentrifugalPump_CP200',
    assetId: 'urn:mfr:siemens:pump:cp200:sn-44821',
    description: 'Digital twin — Centrifugal Pump CP200 Line',
    assetKind: 'Instance',
    versions: [
      {
        version: '3.0.0', revision: 'A', date: '2026-03-10T14:22:00Z', status: 'Draft',
        author: 'M. Pistone',
        changes: 'Aggiunto submodel PredictiveMaintenance con semanticId ECLASS',
        details: [
          { type: 'added', target: 'Submodel', name: 'PredictiveMaintenance', desc: 'Nuovo submodel manutenzione predittiva con HealthIndex e RUL' },
          { type: 'added', target: 'Property', name: 'PredictiveMaintenance.HealthIndex', desc: 'Indice salute asset (0-100)' },
          { type: 'added', target: 'Property', name: 'PredictiveMaintenance.RemainingUsefulLife', desc: 'Vita utile residua in ore' },
          { type: 'added', target: 'Collection', name: 'PredictiveMaintenance.MaintenanceSchedule', desc: 'Scheduling manutenzione' },
        ],
      },
    ],
    submodels: [
      { ...SM_CATALOG[0], id: `${SM_CATALOG[0].semanticId}:inst:aas-pump-001`, elements: SM_CATALOG[0].elements.map(e => ({ ...e, value: e.type === 'MultiLanguageProperty' ? {} : '' })) },
      { ...SM_CATALOG[2], id: `${SM_CATALOG[2].semanticId}:inst:aas-pump-001`, elements: SM_CATALOG[2].elements.map(e => ({ ...e, value: '' })) },
    ],
  },
  {
    id: 'aas-robot-002',
    idShort: 'AAS_IndustrialRobot_KR60',
    assetId: 'urn:mfr:kuka:robot:kr60:sn-88412',
    description: 'Digital twin — KUKA KR 60 HA',
    assetKind: 'Instance',
    versions: [
      {
        version: '1.2.0', revision: 'A', date: '2026-03-01T10:00:00Z', status: 'Active',
        author: 'L. Ferrara',
        changes: 'Aggiunto OperationalData submodel',
        details: [
          { type: 'added', target: 'Submodel', name: 'OperationalData', desc: 'Dati operativi real-time' },
          { type: 'added', target: 'Property', name: 'OperationalData.OperatingHours', desc: 'Ore di funzionamento' },
        ],
      },
    ],
    submodels: [
      { ...SM_CATALOG[0], id: `${SM_CATALOG[0].semanticId}:inst:aas-robot-002`, elements: SM_CATALOG[0].elements.map(e => ({ ...e, value: e.type === 'MultiLanguageProperty' ? {} : '' })) },
      { ...SM_CATALOG[4], id: `${SM_CATALOG[4].semanticId}:inst:aas-robot-002`, elements: SM_CATALOG[4].elements.map(e => ({ ...e, value: '' })) },
    ],
  },
  {
    id: 'aas-sensor-003',
    idShort: 'AAS_TempSensor_TS400',
    assetId: 'urn:mfr:bosch:sensor:ts400:sn-12093',
    description: 'Digital twin — Bosch TS400 Temperature Sensor',
    assetKind: 'Instance',
    versions: [
      {
        version: '2.0.0', revision: 'A', date: '2026-02-28T15:20:00Z', status: 'Active',
        author: 'M. Pistone',
        changes: 'Migrazione a AAS v3 metamodel',
        details: [
          { type: 'modified', target: 'Submodel', name: 'Nameplate', desc: 'Migrato a schema AAS v3' },
          { type: 'modified', target: 'Submodel', name: 'TechnicalData', desc: 'Allineato a IDTA template v1.2' },
        ],
      },
    ],
    submodels: [
      { ...SM_CATALOG[0], id: `${SM_CATALOG[0].semanticId}:inst:aas-sensor-003`, elements: SM_CATALOG[0].elements.map(e => ({ ...e, value: e.type === 'MultiLanguageProperty' ? {} : '' })) },
      { ...SM_CATALOG[2], id: `${SM_CATALOG[2].semanticId}:inst:aas-sensor-003`, elements: SM_CATALOG[2].elements.map(e => ({ ...e, value: '' })) },
    ],
  },
  {
    id: 'aas-conveyor-004',
    idShort: 'AAS_ConveyorBelt_CB100',
    assetId: 'urn:mfr:festo:conveyor:cb100:sn-55110',
    description: 'Digital twin — Festo CB100 Conveyor Belt',
    assetKind: 'Type',
    versions: [
      {
        version: '1.0.0', revision: 'A', date: '2026-03-05T11:10:00Z', status: 'Draft',
        author: 'A. Rossi',
        changes: 'Modello type iniziale',
        details: [
          { type: 'added', target: 'Submodel', name: 'Nameplate', desc: 'Nameplate Festo' },
          { type: 'added', target: 'Submodel', name: 'TechnicalData', desc: 'Specifiche tecniche nastro' },
          { type: 'added', target: 'Submodel', name: 'BillOfMaterial', desc: 'BOM componenti nastro' },
        ],
      },
    ],
    submodels: [
      { ...SM_CATALOG[0], id: `${SM_CATALOG[0].semanticId}:inst:aas-conveyor-004`, elements: SM_CATALOG[0].elements.map(e => ({ ...e, value: e.type === 'MultiLanguageProperty' ? {} : '' })) },
      { ...SM_CATALOG[7], id: `${SM_CATALOG[7].semanticId}:inst:aas-conveyor-004`, elements: SM_CATALOG[7].elements.map(e => ({ ...e, value: '' })) },
    ],
  },
];

// ═══════════════════════════════════
// VALIDATION ENGINE
// ═══════════════════════════════════

export function validateAAS(
  aas: { idShort: string; assetId: string },
  sms: SubmodelTemplate[]
): ValidationResult {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const infos: ValidationFinding[] = [];

  const addFinding = (collection: ValidationFinding[], path: string, msg: string, rule: string) => {
    collection.push({ path, msg, rule });
  };

  const validateIdShort = (idShort: string | undefined, path: string, emptyRule: string, formatRule: string) => {
    if (!idShort?.trim()) {
      addFinding(errors, path, 'idShort obbligatorio', emptyRule);
    } else if (!/^[a-zA-Z_]\w*$/.test(idShort)) {
      addFinding(errors, path, `"${idShort}" non valido`, formatRule);
    }
  };

  validateIdShort(aas.idShort, 'AAS', 'AAS-001', 'AAS-002');

  if (!aas.assetId?.trim()) addFinding(errors, 'AAS.assetId', 'globalAssetId obbligatorio', 'AAS-003');
  else if (!aas.assetId.startsWith('urn:')) addFinding(warnings, 'AAS.assetId', 'Formato URN raccomandato', 'W001');

  if (!sms.length) addFinding(warnings, 'AAS', 'Nessun submodel', 'W002');

  const sIds = new Set<string>();
  sms.forEach((s, i) => {
    const p = `SM[${i}] "${s.idShort || '?'}"`;
    validateIdShort(s.idShort, p, 'SM-001', 'SM-002');

    if (s.idShort && sIds.has(s.idShort)) addFinding(errors, p, `"${s.idShort}" duplicato`, 'SM-003');
    if (s.idShort) sIds.add(s.idShort);

    if (!s.semanticId?.trim()) addFinding(warnings, p, 'semanticId mancante', 'SW001');
    if (!s.elements?.length) addFinding(infos, p, 'Submodel vuoto', 'SI001');

    const eIds = new Set<string>();
    (s.elements || []).forEach((el, ei) => {
      const ep = `${p} → ${el.idShort || `[${ei}]`}`;
      validateIdShort(el.idShort, ep, 'EL-001', 'EL-002');

      if (el.idShort && eIds.has(el.idShort)) addFinding(errors, ep, `"${el.idShort}" duplicato`, 'EL-003');
      if (el.idShort) eIds.add(el.idShort);

      if (el.type === 'Property') {
        if (!el.valueType) addFinding(errors, ep, 'valueType obbligatorio', 'EL-004');
        const v = typeof el.value === 'string' ? el.value : '';
        if (v) {
          if (el.valueType === 'xs:int' && isNaN(parseInt(v))) addFinding(errors, ep, `"${v}" non intero`, 'EL-005');
          if ((el.valueType === 'xs:double' || el.valueType === 'xs:float') && isNaN(parseFloat(v))) addFinding(errors, ep, `"${v}" non numero`, 'EL-006');
          if (el.valueType === 'xs:boolean' && !['true', 'false', '0', '1'].includes(v.toLowerCase())) addFinding(errors, ep, `"${v}" non booleano`, 'EL-007');
        }
      }
      if (!el.semanticId) addFinding(infos, ep, 'semanticId mancante', 'EI001');
      if (el.required && el.type !== 'SubmodelElementCollection') {
        const isEmpty = el.value === undefined || el.value === ''
          || (typeof el.value === 'object' && Object.keys(el.value).length === 0);
        if (isEmpty) addFinding(errors, ep, 'Campo required vuoto', 'EL-008');
      }
    });
  });

  return { errors, warnings, infos, valid: errors.length === 0 };
}

// ═══════════════════════════════════
// CONTEXT
// ═══════════════════════════════════

interface AASContextType {
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  availableModels: AASModel[];
  currentModel: AASModel;
  currentVersion: AASVersion;
  createModel: (data: { idShort: string; assetId: string; description: string; assetKind: AssetKind }) => void;
  updateCurrentModel: (patch: Partial<AASModel>) => void;
  addSubmodel: (sm: SubmodelTemplate) => void;
  removeSubmodel: (id: string) => void;
  updateSubmodel: (smId: string, patch: Partial<SubmodelTemplate>) => void;
  updateElement: (smId: string, elIdx: number, field: string, value: string | Record<string, string>) => void;
  importAas: (model: AASModel) => void;
  setSubmodels: (sms: SubmodelTemplate[]) => void; // Added back for VersionHistory compatibility
}

const AASContext = createContext<AASContextType | null>(null);

export function AASProvider({ children }: { children: ReactNode }) {
  const [availableModels, setAvailableModels] = useState<AASModel[]>(() => {
    const saved = localStorage.getItem('aas_studio_models');
    return saved ? JSON.parse(saved) : MOCK_AAS_DB;
  });
  
  const [selectedModelId, setSelectedModelId] = useState(availableModels[0]?.id || '');

  // Persistence to localStorage
  useEffect(() => {
    localStorage.setItem('aas_studio_models', JSON.stringify(availableModels));
  }, [availableModels]);

  const currentModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];
  
  const currentVersion = currentModel?.versions[0] || {
    version: '1.0.0', revision: 'A', date: new Date().toISOString(), status: 'Draft',
    author: 'System', changes: 'Model state', details: []
  };

  const createModel = useCallback((data: { idShort: string; assetId: string; description: string; assetKind: AssetKind }) => {
    const id = `aas-${data.idShort.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const newModel: AASModel = {
      id,
      idShort: data.idShort,
      assetId: data.assetId,
      description: data.description,
      assetKind: data.assetKind,
      versions: [{ version: '1.0.0', revision: 'A', date: new Date().toISOString(), status: 'Draft', author: 'User', changes: 'Initial creation', details: [] }],
      submodels: [],
    };
    setAvailableModels(prev => [...prev, newModel]);
    setSelectedModelId(id);
  }, []);

  const updateCurrentModel = useCallback((patch: Partial<AASModel>) => {
    setAvailableModels(prev => prev.map(m => 
      m.id === selectedModelId ? { ...m, ...patch } : m
    ));
  }, [selectedModelId]);

  const setSubmodels = useCallback((sms: SubmodelTemplate[]) => {
    updateCurrentModel({ submodels: sms });
  }, [updateCurrentModel]);

  const addSubmodel = useCallback((sm: SubmodelTemplate) => {
    setAvailableModels(prev => prev.map(m => 
      m.id === selectedModelId ? { ...m, submodels: [...m.submodels, sm] } : m
    ));
  }, [selectedModelId]);

  const removeSubmodel = useCallback((id: string) => {
    setAvailableModels(prev => prev.map(m => 
      m.id === selectedModelId ? { ...m, submodels: m.submodels.filter(s => s.id !== id) } : m
    ));
  }, [selectedModelId]);

  const updateSubmodel = useCallback((smId: string, patch: Partial<SubmodelTemplate>) => {
    setAvailableModels(prev => prev.map(m => {
      if (m.id !== selectedModelId) return m;
      return { ...m, submodels: m.submodels.map(s => s.id === smId ? { ...s, ...patch } : s) };
    }));
  }, [selectedModelId]);

  const updateElement = useCallback((smId: string, elIdx: number, field: string, value: string | Record<string, string>) => {
    setAvailableModels(prev => prev.map(m => {
      if (m.id !== selectedModelId) return m;
      return {
        ...m,
        submodels: m.submodels.map(s => {
          if (s.id !== smId) return s;
          const elements = [...s.elements];
          elements[elIdx] = { ...elements[elIdx], [field]: value };
          return { ...s, elements };
        })
      };
    }));
  }, [selectedModelId]);

  const importAas = useCallback((model: AASModel) => {
    const imported = { ...model, isImported: true };
    setAvailableModels(prev => {
      const exists = prev.find(m => m.id === imported.id);
      if (exists) return prev.map(m => m.id === imported.id ? imported : m);
      return [...prev, imported];
    });
    setSelectedModelId(imported.id);
  }, []);

  return (
    <AASContext.Provider
      value={{
        selectedModelId,
        setSelectedModelId,
        availableModels,
        currentModel,
        currentVersion,
        createModel,
        updateCurrentModel,
        addSubmodel,
        removeSubmodel,
        updateSubmodel,
        updateElement,
        importAas,
        setSubmodels,
      }}
    >
      {children}
    </AASContext.Provider>
  );
}

export function useAASContext(): AASContextType {
  const ctx = useContext(AASContext);
  if (!ctx) throw new Error('useAASContext must be used within AASProvider');
  return ctx;
}
