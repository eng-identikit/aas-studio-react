import { useState, useEffect, useRef, useCallback } from 'react';
import { useColorScheme } from '@mui/material/styles';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Fade,
  FormControl,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  BoltRounded,
  CheckCircleRounded,
  ContentCopyRounded,
  DnsRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  FileDownloadRounded,
  OpenInNewRounded,
  PlayArrowRounded,
  RefreshRounded,
  StopRounded,
} from '@mui/icons-material';

import {
  useAASContext,
  type SubmodelTemplate,
  type SubmodelElement,
  type SubmodelElementChild,
} from '@/context/AASContext';
import { useDialogContext } from '@/context/DialogContext';
import { buildAasEnvironment, pyLiteral } from './aasEnvironment';
import { runnerApi, DEBUG_SERVER_URL, type RunnerStatus } from '@/api/runnerApi';

// ═══════════════════════
// GENERATION STEPS
// ═══════════════════════

const GEN_STEPS = [
  'Parsing AAS metamodel…',
  'Generating Pydantic schemas…',
  'Creating route handlers…',
  'Building OpenAPI spec…',
  'Writing Dockerfile & Compose…',
  'Validating IDTA-01002-3-0…',
  '✓ Server generated',
];

// ═══════════════════════
// CODE GENERATORS
// ═══════════════════════

function q(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function fmtUptime(s: number): string {
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

// ═══════════════════════
// CODE VIEWER (editor look, theme-aware, lightweight Python/config highlighter)
// ═══════════════════════

// The runtime log console stays terminal-dark in both modes.
const TERMINAL_BG = '#0d1117';
const TERMINAL_BORDER = '#21262d';

interface CodePalette {
  bg: string;
  border: string;
  gutter: string;
  text: string;
  string: string;
  comment: string;
  keyword: string;
  decorator: string;
  number: string;
  tab: string;
  tabActive: string;
  buttonBorder: string;
  buttonHoverBg: string;
  emptyTitle: string;
  emptyCaption: string;
}

const CODE_DARK: CodePalette = {
  bg: '#0d1117',
  border: '#21262d',
  gutter: '#484f58',
  text: '#c9d1d9',
  string: '#a5d6ff',
  comment: '#8b949e',
  keyword: '#ff7b72',
  decorator: '#d2a8ff',
  number: '#79c0ff',
  tab: '#8b949e',
  tabActive: '#e6edf3',
  buttonBorder: '#30363d',
  buttonHoverBg: 'rgba(177,186,196,.08)',
  emptyTitle: '#e6edf3',
  emptyCaption: '#8b949e',
};

const CODE_LIGHT: CodePalette = {
  bg: '#fbfcfe',
  border: '#d0d7de',
  gutter: '#9ca6b0',
  text: '#1f2328',
  string: '#0a3069',
  comment: '#6e7781',
  keyword: '#cf222e',
  decorator: '#8250df',
  number: '#0550ae',
  tab: '#57606a',
  tabActive: '#1f2328',
  buttonBorder: '#d0d7de',
  buttonHoverBg: 'rgba(31,35,40,.06)',
  emptyTitle: '#24292f',
  emptyCaption: '#57606a',
};

const PY_TOKEN_RE =
  /("""(?:[^"]|"(?!""))*"""|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(#.*$)|\b(def|class|import|from|return|raise|if|elif|else|for|while|in|not|and|or|is|async|await|del|try|except|finally|with|as|pass|lambda|None|True|False)\b|(@[\w.]+)|\b(\d+(?:\.\d+)?)\b/gm;

function highlightLine(line: string, lineKey: number, ct: CodePalette): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(PY_TOKEN_RE.source, 'gm');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index));
    const [tok, str, com, kw, dec] = m;
    const color = str != null ? ct.string
      : com != null ? ct.comment
      : kw != null ? ct.keyword
      : dec != null ? ct.decorator
      : ct.number;
    nodes.push(
      <span key={`${lineKey}-${m.index}`} style={{ color, fontStyle: com != null ? 'italic' : undefined }}>
        {tok}
      </span>,
    );
    last = m.index + tok.length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

function CodeView({ code, ct }: { code: string; ct: CodePalette }) {
  const lines = code.split('\n');
  return (
    <Box sx={{ display: 'flex', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11.5, lineHeight: 1.75 }}>
      <Box sx={{ userSelect: 'none', textAlign: 'right', pr: 1.5, mr: 1.5, borderRight: `1px solid ${ct.border}`, color: ct.gutter, flexShrink: 0 }}>
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </Box>
      <Box sx={{ whiteSpace: 'pre', color: ct.text, minWidth: 0, flex: 1, overflowX: 'auto' }}>
        {lines.map((l, i) => (
          <div key={i}>{l === '' ? ' ' : highlightLine(l, i, ct)}</div>
        ))}
      </Box>
    </Box>
  );
}

const FILE_DOT: Record<string, string> = {
  main: '#4B8BBE',
  models: '#4B8BBE',
  docker: '#2496ED',
  requirements: '#8b949e',
  compose: '#f2c94c',
};

function logLineColor(line: string): string {
  if (line.includes('ERROR') || line.includes('CRITICAL') || line.includes('Traceback')) return '#f85149';
  if (line.includes('WARN')) return '#d29922';
  if (line.includes('[runner]')) return '#79c0ff';
  return '#9da5b4';
}

function generateMainPy(
  aasIdShort: string,
  assetId: string,
  version: string,
  assetKind: string,
  submodels: SubmodelTemplate[],
): string {
  // Same environment the "Run Server" debug runner receives — the generated
  // artifact and the debug server serve identical content by construction.
  const env = buildAasEnvironment(aasIdShort, assetId, version, assetKind, submodels);

  return (
`# Auto-generated AAS Server — ` + aasIdShort + `
# IDTA-01002-3-0 Part 2 compliant — Generated by AASStudio

import base64
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title=` + q(aasIdShort + ' AAS Server') + `,
    version=` + q(version) + `,
    description="AAS Server — Generated by AASStudio (IDTA-01002-3-0)",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── In-memory store ──────────────────────────────────────────────

_SHELLS: dict[str, dict] = ` + pyLiteral(env.shells) + `

_SUBMODELS: dict[str, dict] = ` + pyLiteral(env.submodels) + `

_CONCEPT_DESCRIPTIONS: dict[str, dict] = {}


# ── helpers ──────────────────────────────────────────────────────

def _unb64(encoded: str) -> str:
    try:
        padded = encoded + "=" * (-len(encoded) % 4)
        return base64.urlsafe_b64decode(padded).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64url identifier: " + encoded)


def _paged(items: list, limit: int, cursor: int) -> dict:
    end = cursor + limit
    page = items[cursor:end]
    return {"result": page, "paging_metadata": {"cursor": str(end) if end < len(items) else None}}


def _resolve_element(elements: list[dict], path: list[str]) -> dict | None:
    for el in elements:
        if el.get("idShort") == path[0]:
            if len(path) == 1:
                return el
            children = el.get("value", [])
            if isinstance(children, list):
                return _resolve_element(children, path[1:])
    return None


# ── /shells ──────────────────────────────────────────────────────

@app.get("/shells", tags=["AAS Repository"])
async def get_all_shells(
    limit: int = Query(100, ge=1, le=1000),
    cursor: int = Query(0, ge=0),
):
    return _paged(list(_SHELLS.values()), limit, cursor)


@app.post("/shells", status_code=201, tags=["AAS Repository"])
async def create_shell(shell: dict):
    sid = shell.get("idShort") or shell.get("id")
    if not sid:
        raise HTTPException(status_code=400, detail="Shell must have 'idShort' or 'id'")
    if sid in _SHELLS:
        raise HTTPException(status_code=409, detail="Shell '" + str(sid) + "' already exists")
    _SHELLS[sid] = shell
    return shell


@app.get("/shells/{aas_identifier}", tags=["AAS Interface"])
async def get_shell(aas_identifier: str):
    sid = _unb64(aas_identifier)
    shell = _SHELLS.get(sid)
    if not shell:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    return shell


@app.put("/shells/{aas_identifier}", tags=["AAS Interface"])
async def update_shell(aas_identifier: str, shell: dict):
    sid = _unb64(aas_identifier)
    if sid not in _SHELLS:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    _SHELLS[sid] = shell
    return shell


@app.delete("/shells/{aas_identifier}", status_code=204, tags=["AAS Interface"])
async def delete_shell(aas_identifier: str):
    sid = _unb64(aas_identifier)
    if sid not in _SHELLS:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    del _SHELLS[sid]


@app.get("/shells/{aas_identifier}/submodels", tags=["AAS Interface"])
async def get_shell_submodel_refs(
    aas_identifier: str,
    limit: int = Query(100, ge=1, le=1000),
    cursor: int = Query(0, ge=0),
):
    sid = _unb64(aas_identifier)
    shell = _SHELLS.get(sid)
    if not shell:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    return _paged(shell.get("submodels", []), limit, cursor)


@app.post("/shells/{aas_identifier}/submodels", tags=["AAS Interface"])
async def add_submodel_ref(aas_identifier: str, ref: dict):
    sid = _unb64(aas_identifier)
    shell = _SHELLS.get(sid)
    if not shell:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    shell.setdefault("submodels", []).append(ref)
    return ref


@app.delete("/shells/{aas_identifier}/submodels/{submodel_identifier}", status_code=204, tags=["AAS Interface"])
async def remove_submodel_ref(aas_identifier: str, submodel_identifier: str):
    sid = _unb64(aas_identifier)
    smid = _unb64(submodel_identifier)
    shell = _SHELLS.get(sid)
    if not shell:
        raise HTTPException(status_code=404, detail="Shell '" + sid + "' not found")
    refs = shell.get("submodels", [])
    shell["submodels"] = [
        r for r in refs
        if not any(k.get("value") == smid for k in r.get("keys", []))
    ]


# ── /submodels ───────────────────────────────────────────────────

@app.get("/submodels", tags=["Submodel Repository"])
async def get_all_submodels(
    limit: int = Query(100, ge=1, le=1000),
    cursor: int = Query(0, ge=0),
):
    return _paged(list(_SUBMODELS.values()), limit, cursor)


@app.post("/submodels", status_code=201, tags=["Submodel Repository"])
async def create_submodel(submodel: dict):
    smid = submodel.get("id") or submodel.get("idShort")
    if not smid:
        raise HTTPException(status_code=400, detail="Submodel must have 'id'")
    if smid in _SUBMODELS:
        raise HTTPException(status_code=409, detail="Submodel '" + str(smid) + "' already exists")
    _SUBMODELS[smid] = submodel
    return submodel


@app.get("/submodels/{submodel_identifier}", tags=["Submodel Interface"])
async def get_submodel(submodel_identifier: str):
    smid = _unb64(submodel_identifier)
    sm = _SUBMODELS.get(smid)
    if not sm:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    return sm


@app.put("/submodels/{submodel_identifier}", tags=["Submodel Interface"])
async def update_submodel(submodel_identifier: str, submodel: dict):
    smid = _unb64(submodel_identifier)
    if smid not in _SUBMODELS:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    _SUBMODELS[smid] = submodel
    return submodel


@app.patch("/submodels/{submodel_identifier}", tags=["Submodel Interface"])
async def patch_submodel(submodel_identifier: str, patch: dict):
    smid = _unb64(submodel_identifier)
    if smid not in _SUBMODELS:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    _SUBMODELS[smid].update(patch)
    return _SUBMODELS[smid]


@app.delete("/submodels/{submodel_identifier}", status_code=204, tags=["Submodel Interface"])
async def delete_submodel(submodel_identifier: str):
    smid = _unb64(submodel_identifier)
    if smid not in _SUBMODELS:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    del _SUBMODELS[smid]


@app.get("/submodels/{submodel_identifier}/submodel-elements", tags=["Submodel Interface"])
async def get_submodel_elements(
    submodel_identifier: str,
    limit: int = Query(100, ge=1, le=1000),
    cursor: int = Query(0, ge=0),
):
    smid = _unb64(submodel_identifier)
    sm = _SUBMODELS.get(smid)
    if not sm:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    return _paged(sm.get("submodelElements", []), limit, cursor)


@app.get("/submodels/{submodel_identifier}/submodel-elements/{id_short_path:path}", tags=["Submodel Interface"])
async def get_submodel_element(submodel_identifier: str, id_short_path: str):
    smid = _unb64(submodel_identifier)
    sm = _SUBMODELS.get(smid)
    if not sm:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    el = _resolve_element(sm.get("submodelElements", []), id_short_path.split("."))
    if el is None:
        raise HTTPException(status_code=404, detail="Element '" + id_short_path + "' not found")
    return el


@app.patch("/submodels/{submodel_identifier}/submodel-elements/{id_short_path:path}", tags=["Submodel Interface"])
async def patch_submodel_element(submodel_identifier: str, id_short_path: str, body: dict):
    smid = _unb64(submodel_identifier)
    sm = _SUBMODELS.get(smid)
    if not sm:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    el = _resolve_element(sm.get("submodelElements", []), id_short_path.split("."))
    if el is None:
        raise HTTPException(status_code=404, detail="Element '" + id_short_path + "' not found")
    el.update(body)
    return el


@app.put("/submodels/{submodel_identifier}/submodel-elements/{id_short_path:path}", tags=["Submodel Interface"])
async def put_submodel_element(submodel_identifier: str, id_short_path: str, element: dict):
    smid = _unb64(submodel_identifier)
    sm = _SUBMODELS.get(smid)
    if not sm:
        raise HTTPException(status_code=404, detail="Submodel '" + smid + "' not found")
    elements = sm.get("submodelElements", [])
    path = id_short_path.split(".")
    parent = _resolve_element(elements, path[:-1]) if len(path) > 1 else None
    target: list = parent["value"] if parent else elements
    for i, el in enumerate(target):
        if el.get("idShort") == path[-1]:
            target[i] = element
            return element
    target.append(element)
    return element


# ── /concept-descriptions ─────────────────────────────────────────

@app.get("/concept-descriptions", tags=["ConceptDescription Repository"])
async def get_concept_descriptions(
    limit: int = Query(100, ge=1, le=1000),
    cursor: int = Query(0, ge=0),
):
    return _paged(list(_CONCEPT_DESCRIPTIONS.values()), limit, cursor)


@app.post("/concept-descriptions", status_code=201, tags=["ConceptDescription Repository"])
async def create_concept_description(cd: dict):
    cdid = cd.get("id")
    if not cdid:
        raise HTTPException(status_code=400, detail="ConceptDescription must have 'id'")
    _CONCEPT_DESCRIPTIONS[cdid] = cd
    return cd


@app.get("/concept-descriptions/{cd_identifier}", tags=["ConceptDescription Repository"])
async def get_concept_description(cd_identifier: str):
    cdid = _unb64(cd_identifier)
    cd = _CONCEPT_DESCRIPTIONS.get(cdid)
    if not cd:
        raise HTTPException(status_code=404, detail="ConceptDescription '" + cdid + "' not found")
    return cd


@app.put("/concept-descriptions/{cd_identifier}", tags=["ConceptDescription Repository"])
async def put_concept_description(cd_identifier: str, cd: dict):
    cdid = _unb64(cd_identifier)
    _CONCEPT_DESCRIPTIONS[cdid] = cd
    return cd


@app.delete("/concept-descriptions/{cd_identifier}", status_code=204, tags=["ConceptDescription Repository"])
async def delete_concept_description(cd_identifier: str):
    cdid = _unb64(cd_identifier)
    if cdid not in _CONCEPT_DESCRIPTIONS:
        raise HTTPException(status_code=404, detail="ConceptDescription '" + cdid + "' not found")
    del _CONCEPT_DESCRIPTIONS[cdid]


# ── server meta ───────────────────────────────────────────────────

@app.get("/health", tags=["Server"])
async def health():
    return {
        "status": "ok",
        "version": ` + q(version) + `,
        "shells": len(_SHELLS),
        "submodels": len(_SUBMODELS),
        "concept_descriptions": len(_CONCEPT_DESCRIPTIONS),
    }


@app.get("/description", tags=["Server"])
async def description():
    return {
        "profiles": [
            "https://admin-shell.io/aas/API/3/0/AssetAdministrationShellRepositoryServiceSpecification/SSP-002",
            "https://admin-shell.io/aas/API/3/0/SubmodelRepositoryServiceSpecification/SSP-002",
            "https://admin-shell.io/aas/API/3/0/ConceptDescriptionRepositoryServiceSpecification/SSP-001",
        ]
    }
`
  );
}

function generateModelsPy(submodels: SubmodelTemplate[]): string {
  const xsdToPy: Record<string, string> = {
    'xs:string': 'str',
    'xs:int': 'int',
    'xs:long': 'int',
    'xs:short': 'int',
    'xs:byte': 'int',
    'xs:double': 'float',
    'xs:float': 'float',
    'xs:boolean': 'bool',
    'xs:date': 'date',
    'xs:dateTime': 'datetime',
    'xs:anyURI': 'str',
    'xs:duration': 'str',
    'xs:decimal': 'Decimal',
  };

  function pyType(el: SubmodelElement | SubmodelElementChild): string {
    switch (el.type) {
      case 'Property': return xsdToPy[el.valueType || 'xs:string'] || 'str';
      case 'MultiLanguageProperty': return 'List[LangString]';
      case 'SubmodelElementCollection': return el.idShort + 'Collection';
      case 'Operation': return 'OperationModel';
      case 'File': return 'FileElement';
      case 'Blob': return 'BlobElement';
      case 'ReferenceElement': return 'Optional[Reference]';
      default: return 'Any';
    }
  }

  function collectionClass(el: SubmodelElement | SubmodelElementChild): string {
    if (el.type !== 'SubmodelElementCollection') return '';
    const smEl = el as SubmodelElement;
    if (!smEl.children || smEl.children.length === 0) return '';
    const fields = smEl.children.map(c => {
      const ft = pyType(c);
      return '    ' + c.idShort + ': Optional[' + ft + '] = None';
    }).join('\n');
    return '\nclass ' + el.idShort + 'Collection(BaseModel):\n' + fields + '\n';
  }

  function submodelClass(sm: SubmodelTemplate): string {
    const nestedClasses = sm.elements
      .filter(e => e.type === 'SubmodelElementCollection')
      .map(e => collectionClass(e))
      .join('');
    const fields = sm.elements.map(e => {
      const ft = pyType(e);
      const wrapped = e.required ? ft : 'Optional[' + ft + ']';
      return '    ' + e.idShort + ': ' + wrapped + ' = None';
    }).join('\n');
    const docstring = '    """' + (sm.description || sm.idShort) + ' — ' + sm.semanticId + '"""';
    return nestedClasses + '\nclass ' + sm.idShort + 'Model(BaseModel):\n' + docstring + '\n' + (fields || '    pass') + '\n';
  }

  const allElements = submodels.flatMap(sm => sm.elements);
  const needsDate = allElements.some(e => e.valueType === 'xs:date' || e.valueType === 'xs:dateTime');
  const needsDecimal = allElements.some(e => e.valueType === 'xs:decimal');

  const dateImport = needsDate ? '\nfrom datetime import date, datetime' : '';
  const decimalImport = needsDecimal ? '\nfrom decimal import Decimal' : '';

  const baseTypes = `

# ── AAS base types ───────────────────────────────────────────────

class LangString(BaseModel):
    language: str = "en"
    text: str = ""


class Key(BaseModel):
    type: str
    value: str


class Reference(BaseModel):
    type: str = "ExternalReference"
    keys: List[Key] = []


class OperationVariable(BaseModel):
    value: Any = None


class OperationModel(BaseModel):
    inputVariables: List[OperationVariable] = []
    outputVariables: List[OperationVariable] = []
    inoutputVariables: List[OperationVariable] = []


class FileElement(BaseModel):
    contentType: str = "application/octet-stream"
    value: Optional[str] = None


class BlobElement(BaseModel):
    contentType: str = "application/octet-stream"
    value: Optional[str] = None

`;

  return (
    'from __future__ import annotations\n\n' +
    'from typing import Any, List, Optional' +
    dateImport +
    decimalImport + '\n\n' +
    'from pydantic import BaseModel\n' +
    baseTypes +
    submodels.map(submodelClass).join('\n')
  );
}

function generateDockerfile(): string {
  return `FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \\
    && pip install --no-cache-dir -r requirements.txt --target /build/deps

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PYTHONPATH=/app/deps

RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app
COPY --from=builder /build/deps ./deps
COPY . .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
}

function generateRequirements(): string {
  return `fastapi>=0.110.0
uvicorn[standard]>=0.29.0
pydantic>=2.0.0
python-multipart>=0.0.9
`;
}

function generateDockerCompose(aasIdShort: string, version: string): string {
  const serviceName = aasIdShort.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
`services:
  ` + serviceName + `:
    build: .
    container_name: ` + serviceName + `-server
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    restart: unless-stopped
    labels:
      aas.version: "` + version + `"
      aas.spec: "IDTA-01002-3-0"
`
  );
}

// ═══════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════

type CodeTab = 'main' | 'models' | 'docker' | 'requirements' | 'compose';

export default function AASServer() {
  const { selectedModelId, setSelectedModelId, availableModels, currentModel, currentVersion } = useAASContext();
  const submodels = currentModel?.submodels ?? [];
  const aasIdShort = currentModel?.idShort ?? '';
  const { setHandlers } = useDialogContext();

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genProgress, setGenProgress] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<CodeTab>('main');
  const [copied, setCopied] = useState(false);

  // Code panel follows the app color scheme: GitHub-dark in dark mode,
  // GitHub-light in light mode.
  const { mode, systemMode } = useColorScheme();
  const isDarkMode = (mode === 'system' ? systemMode : mode) === 'dark';
  const ct = isDarkMode ? CODE_DARK : CODE_LIGHT;

  // ── Runtime debug (aas-server-runner) ──
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus | null>(null);
  const [runnerReachable, setRunnerReachable] = useState<boolean | null>(null);
  const [runnerBusy, setRunnerBusy] = useState<'start' | 'stop' | null>(null);
  const [runnerError, setRunnerError] = useState('');
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const isRunning = runnerStatus?.running === true;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await runnerApi.status();
        if (cancelled) return;
        setRunnerReachable(true);
        setRunnerStatus(st);
        if (st.running && showLogs) {
          const lg = await runnerApi.logs(150);
          if (!cancelled) setRunLogs(lg.lines);
        }
      } catch {
        if (!cancelled) {
          setRunnerReachable(false);
          setRunnerStatus(null);
        }
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [showLogs]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ block: 'end' });
  }, [runLogs]);

  const handleRunServer = useCallback(async () => {
    if (!currentModel) return;
    setRunnerBusy('start');
    setRunnerError('');
    try {
      const env = buildAasEnvironment(
        currentModel.idShort,
        currentModel.assetId,
        currentVersion.version,
        currentModel.assetKind,
        currentModel.submodels,
      );
      const st = await runnerApi.start(env);
      setRunnerStatus(st);
      setRunnerReachable(true);
      setShowLogs(true);
    } catch (err) {
      const offline = err instanceof TypeError;
      setRunnerError(offline
        ? 'Runner non raggiungibile su :6790 — avvialo con "python -m runner" in aas-server-runner/'
        : (err instanceof Error ? err.message : 'Errore durante l\'avvio del server'));
      if (offline) setRunnerReachable(false);
    } finally {
      setRunnerBusy(null);
    }
  }, [currentModel, currentVersion]);

  const handleStopServer = useCallback(async () => {
    setRunnerBusy('stop');
    setRunnerError('');
    try {
      const st = await runnerApi.stop();
      setRunnerStatus(st);
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : 'Errore durante l\'arresto del server');
    } finally {
      setRunnerBusy(null);
    }
  }, []);

  const runGeneration = () => {
    setGenerating(true);
    setGenerated(false);
    setGenProgress([]);
    GEN_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setGenProgress(prev => [...prev, step]);
        if (i === GEN_STEPS.length - 1) {
          setGenerating(false);
          setGenerated(true);
        }
      }, (i + 1) * 500);
    });
  };

  const getCode = (): string => {
    if (!generated) return '';
    switch (activeTab) {
      case 'main': return generateMainPy(aasIdShort, currentModel.assetId, currentVersion.version, currentModel.assetKind, submodels);
      case 'models': return generateModelsPy(submodels);
      case 'docker': return generateDockerfile();
      case 'requirements': return generateRequirements();
      case 'compose': return generateDockerCompose(aasIdShort, currentVersion.version);
      default: return '';
    }
  };

  const handleCopy = async () => {
    const code = getCode();
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getCode();
    if (!code) return;
    const fileNames: Record<CodeTab, string> = {
      main: 'main.py',
      models: 'models.py',
      docker: 'Dockerfile',
      requirements: 'requirements.txt',
      compose: 'docker-compose.yml',
    };
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNames[activeTab];
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: CodeTab; label: string }[] = [
    { key: 'main', label: 'main.py' },
    { key: 'models', label: 'models.py' },
    { key: 'docker', label: 'Dockerfile' },
    { key: 'requirements', label: 'requirements.txt' },
    { key: 'compose', label: 'docker-compose.yml' },
  ];

  useEffect(() => {
    setHandlers({ onGenerateServer: runGeneration, onDownloadServer: handleDownload, onRunServer: handleRunServer });
    return () => setHandlers({});
  }, [generated, activeTab, handleRunServer]);

  // No model available (e.g. the server is unreachable / the session expired so
  // nothing loaded). Render an empty state instead of dereferencing currentModel.
  if (!currentModel) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Stack spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight={700}>No AAS model available</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Create or import a model first. If you expected existing models, your session may have
            expired — try signing in again.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left Panel ── */}
      <Box
        sx={{
          width: 300,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          p: 2.25,
          gap: 1.75,
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center',
              color: '#fff', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 14px rgba(99,102,241,.35)',
            }}
          >
            <DnsRounded sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>Server Generator</Typography>
            <Typography variant="caption" color="text.disabled" fontFamily="monospace" display="block">
              FastAPI · IDTA-01002-3-0
            </Typography>
          </Box>
        </Stack>

        <Box>
          <Typography variant="overline" color="text.disabled" display="block" mb={0.75}>AAS Model</Typography>
          <FormControl size="small" fullWidth>
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
        </Box>

        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
          <Typography variant="overline" color="text.disabled" display="block" mb={0.5}>source shell</Typography>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace" noWrap mb={1.25}>{aasIdShort}</Typography>
          <Stack direction="row" spacing={1}>
            {([
              ['Submodels', submodels.length],
              ['Properties', submodels.flatMap(s => s.elements).filter(e => e.type === 'Property').length],
              ['Operations', submodels.flatMap(s => s.elements).filter(e => e.type === 'Operation').length],
            ] as [string, number][]).map(([k, v]) => (
              <Box key={k} sx={{ flex: 1, textAlign: 'center', py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography fontFamily="monospace" fontWeight={700} color="primary.main" fontSize={16} lineHeight={1.15}>
                  {v}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>
                  {k}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* ── Runtime debug: primary action, above Generate and out of the box ── */}
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={runnerBusy === 'start' ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRounded />}
              onClick={handleRunServer}
              disabled={runnerBusy !== null || runnerReachable === false}
              sx={{
                flex: 1,
                fontWeight: 600,
                transition: 'transform .2s ease, box-shadow .2s ease',
                // '&&' beats the theme's dark-mode MuiButton gradient override
                '&&': {
                  color: '#fff',
                  background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16,185,129,.3)',
                },
                '&&:hover': {
                  background: 'linear-gradient(135deg, #34d399 0%, #047857 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(16,185,129,.4)',
                },
                '&&.Mui-disabled': {
                  background: 'rgba(148,163,184,.25)',
                  color: 'rgba(100,116,139,.8)',
                  boxShadow: 'none',
                },
              }}
            >
              {runnerBusy === 'start' ? 'Avvio…' : isRunning ? 'Redeploy' : 'Run Server'}
            </Button>
            {isRunning && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopRounded />}
                onClick={handleStopServer}
                disabled={runnerBusy !== null}
                sx={{ flexShrink: 0 }}
              >
                {runnerBusy === 'stop' ? 'Arresto…' : 'Stop'}
              </Button>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap" sx={{ px: 0.25 }}>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.6,
                px: 1, py: 0.3, borderRadius: 5, flexShrink: 0,
                bgcolor: isRunning
                  ? 'rgba(34,197,94,.12)'
                  : runnerReachable === false ? 'rgba(148,163,184,.15)' : 'rgba(234,179,8,.12)',
              }}
            >
              <Box
                sx={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  bgcolor: isRunning
                    ? 'success.main'
                    : runnerReachable === false ? 'text.disabled' : 'warning.main',
                  ...(isRunning && {
                    animation: 'aasLivePulse 1.6s ease-in-out infinite',
                    '@keyframes aasLivePulse': {
                      '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,197,94,.55)' },
                      '50%': { boxShadow: '0 0 0 5px rgba(34,197,94,0)' },
                    },
                  }),
                }}
              />
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  fontSize: 10, letterSpacing: 0.8,
                  color: isRunning
                    ? 'success.main'
                    : runnerReachable === false ? 'text.disabled' : 'warning.main',
                }}
              >
                {isRunning ? 'LIVE' : runnerReachable === false ? 'OFFLINE' : 'IDLE'}
              </Typography>
            </Box>

            {runnerReachable === false ? (
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
                avvia <Box component="span" fontFamily="monospace">python -m runner</Box> (:6790)
              </Typography>
            ) : isRunning ? (
              <Typography variant="caption" fontFamily="monospace" color="success.main" noWrap sx={{ flex: 1, minWidth: 0 }}>
                :{runnerStatus?.port} · up {fmtUptime(runnerStatus?.uptimeSeconds ?? 0)}
              </Typography>
            ) : (
              <Typography variant="caption" fontFamily="monospace" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                porta :6789
              </Typography>
            )}

            {isRunning && (
              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <Button
                  size="small"
                  variant="text"
                  endIcon={<OpenInNewRounded sx={{ fontSize: 12 }} />}
                  component="a"
                  href={`${DEBUG_SERVER_URL}/api/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ minWidth: 0, px: 0.75 }}
                >
                  Docs
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  endIcon={showLogs ? <ExpandLessRounded sx={{ fontSize: 14 }} /> : <ExpandMoreRounded sx={{ fontSize: 14 }} />}
                  onClick={() => setShowLogs(v => !v)}
                  sx={{ minWidth: 0, px: 0.75 }}
                >
                  Log
                </Button>
              </Stack>
            )}
          </Stack>

          {runnerError && (
            <Typography variant="caption" color="error.main">
              {runnerError}
            </Typography>
          )}

          <Collapse in={isRunning && showLogs}>
            <Box sx={{ mt: 1, p: 1.25, borderRadius: 1.5, bgcolor: TERMINAL_BG, border: `1px solid ${TERMINAL_BORDER}`, maxHeight: 180, overflowY: 'auto' }}>
              {runLogs.length === 0 ? (
                <Typography variant="caption" color="text.disabled" fontFamily="monospace" fontSize={10}>
                  — nessun log —
                </Typography>
              ) : (
                runLogs.map((line, i) => {
                  const sep = line.indexOf(' | ');
                  const ts = sep > 0 ? line.slice(0, sep) : '';
                  const rest = sep > 0 ? line.slice(sep + 3) : line;
                  return (
                    <Typography
                      key={i}
                      variant="caption"
                      component="div"
                      fontFamily="monospace"
                      sx={{ fontSize: 10, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                    >
                      {ts && <Box component="span" sx={{ color: '#484f58' }}>{ts}  </Box>}
                      <Box component="span" sx={{ color: logLineColor(rest) }}>{rest}</Box>
                    </Typography>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </Box>
          </Collapse>
        </Stack>

        <Divider />

        <Button
          variant="contained"
          onClick={runGeneration}
          disabled={generating}
          startIcon={generating || generated ? <RefreshRounded /> : <BoltRounded />}
          sx={{
            fontWeight: 600,
            transition: 'transform .2s ease, box-shadow .2s ease',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(99,102,241,.35)' },
          }}
        >
          {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate Server'}
        </Button>

        {(generating || generated) && genProgress.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
            <Stack spacing={0.9}>
              {genProgress.map((step, i) => {
                const isCurrent = i === genProgress.length - 1 && !generated;
                return (
                  <Fade in key={i} timeout={300}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {isCurrent ? (
                        <CircularProgress size={13} thickness={5} sx={{ flexShrink: 0 }} />
                      ) : (
                        <CheckCircleRounded sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                      )}
                      <Typography
                        variant="caption"
                        fontFamily="monospace"
                        color={isCurrent ? 'text.primary' : i === genProgress.length - 1 ? 'success.main' : 'text.secondary'}
                      >
                        {step}
                      </Typography>
                    </Stack>
                  </Fade>
                );
              })}
            </Stack>
          </Paper>
        )}

        {generated && (
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: 'success.main', bgcolor: 'rgba(16,185,129,.05)' }}>
            <Typography variant="caption" fontWeight={600} color="success.main" display="block" mb={0.75}>
              Server config
            </Typography>
            <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ lineHeight: 1.9 }} component="div">
              Host: 0.0.0.0:8000<br />
              Runtime: Python 3.12<br />
              Framework: FastAPI 0.110<br />
              Spec: IDTA-01002-3-0
            </Typography>
          </Paper>
        )}
      </Box>

      {/* ── Right: Code Panel (theme-aware editor) ── */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: ct.bg, transition: 'background-color .25s ease' }}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 2, borderBottom: `1px solid ${ct.border}`, flexShrink: 0 }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as CodeTab)}
            textColor="inherit"
            variant="scrollable"
            scrollButtons={false}
            slotProps={{ indicator: { style: { height: 2 } } }}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': { color: ct.tab },
              '& .MuiTab-root.Mui-selected': { color: ct.tabActive },
            }}
          >
            {tabs.map(tab => (
              <Tab
                key={tab.key}
                value={tab.key}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: FILE_DOT[tab.key], flexShrink: 0 }} />
                    <span>{tab.label}</span>
                  </Stack>
                }
                sx={{ fontFamily: 'monospace', fontSize: 11, minHeight: 44, textTransform: 'none' }}
              />
            ))}
          </Tabs>
          <Box flexGrow={1} />
          {generated && (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography variant="caption" fontFamily="monospace" sx={{ color: ct.gutter, mr: 0.5 }}>
                {getCode().split('\n').length} LOC
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={<ContentCopyRounded sx={{ fontSize: 13 }} />}
                onClick={handleCopy}
                sx={{ color: copied ? 'success.main' : ct.tab, '&:hover': { color: ct.tabActive } }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadRounded sx={{ fontSize: 13 }} />}
                onClick={handleDownload}
                sx={{
                  color: ct.text, borderColor: ct.buttonBorder,
                  '&:hover': { borderColor: ct.tab, bgcolor: ct.buttonHoverBg },
                }}
              >
                Download
              </Button>
            </Stack>
          )}
        </Stack>

        {generating && (
          <LinearProgress
            sx={{
              flexShrink: 0, height: 2, bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' },
            }}
          />
        )}

        <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
          {!generated ? (
            <Stack alignItems="center" justifyContent="center" height="100%" spacing={1.5}>
              <Box
                sx={{
                  width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  border: `1px solid ${ct.border}`,
                  background: `radial-gradient(circle at 50% 35%, ${isDarkMode ? 'rgba(99,102,241,.28)' : 'rgba(99,102,241,.14)'}, transparent 72%)`,
                  boxShadow: `0 0 44px ${isDarkMode ? 'rgba(99,102,241,.22)' : 'rgba(99,102,241,.15)'}`,
                  ...(generating && {
                    animation: 'aasGlow 1.4s ease-in-out infinite',
                    '@keyframes aasGlow': {
                      '0%, 100%': { boxShadow: '0 0 30px rgba(99,102,241,.15)' },
                      '50%': { boxShadow: '0 0 60px rgba(99,102,241,.4)' },
                    },
                  }),
                }}
              >
                <BoltRounded sx={{ fontSize: 38, color: isDarkMode ? '#8b95f6' : '#6366f1' }} />
              </Box>
              <Typography variant="body2" fontWeight={600} sx={{ color: ct.emptyTitle }}>
                {generating ? 'Generazione in corso…' : 'Clicca "Generate Server" per iniziare'}
              </Typography>
              <Typography variant="caption" fontFamily="monospace" sx={{ color: ct.emptyCaption }}>
                {submodels.length} submodel{submodels.length !== 1 ? 's' : ''} · FastAPI · IDTA compliant
              </Typography>
            </Stack>
          ) : (
            <Fade in key={activeTab} timeout={350}>
              <Box>
                <CodeView code={getCode()} ct={ct} />
              </Box>
            </Fade>
          )}
        </Box>
      </Box>
    </Box>
  );
}
