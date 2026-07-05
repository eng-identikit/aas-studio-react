// ─────────────────────────────────────────────────────────────────────────────
// Template registry: remembers the structure of submodel templates (built-in
// catalog + IDTA templates fetched from GitHub) keyed by semanticId, so
// validation can flag mandatory template elements missing from a working copy.
//
// Persisted in localStorage: entries are small (structure only, values blanked)
// and capped, so the cache survives reloads without growing unbounded.
// ─────────────────────────────────────────────────────────────────────────────

import type { SubmodelElement, SubmodelTemplate, ValidationFinding } from '@/context/AASContext';

const STORAGE_KEY = 'aas_studio_template_registry';
const MAX_ENTRIES = 40;

type RegistryMap = Record<string, SubmodelTemplate>;

function readRegistry(): RegistryMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Strip instance values: the registry only needs the structure. */
function stripValues(el: SubmodelElement): SubmodelElement {
  return {
    ...el,
    value: undefined,
    children: el.children?.map(stripValues),
    statements: el.statements?.map(stripValues),
    annotations: el.annotations?.map(stripValues),
    inputVariables: el.inputVariables?.map(stripValues),
    outputVariables: el.outputVariables?.map(stripValues),
    inoutputVariables: el.inoutputVariables?.map(stripValues),
  };
}

/** Remember a template's structure (called when adding from the IDTA catalog). */
export function registerTemplate(template: SubmodelTemplate): void {
  if (!template.semanticId?.trim()) return;
  try {
    const reg = readRegistry();
    reg[template.semanticId] = { ...template, elements: (template.elements ?? []).map(stripValues) };
    const keys = Object.keys(reg);
    // FIFO cap: drop the oldest entries when over budget.
    while (keys.length > MAX_ENTRIES) delete reg[keys.shift()!];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reg));
  } catch {
    // Quota/serialization problems must never break the add flow.
  }
}

/** Resolve the reference template for a semanticId (built-ins win). */
export function findTemplate(semanticId: string | undefined, builtins: SubmodelTemplate[]): SubmodelTemplate | null {
  if (!semanticId?.trim()) return null;
  const builtin = builtins.find(t => t.semanticId === semanticId);
  if (builtin) return builtin;
  return readRegistry()[semanticId] ?? null;
}

/**
 * Compare a working submodel against its reference template.
 * - TPL-001 (error): mandatory template element missing from the submodel.
 * - TPL-002 (warning): element present but with a different type than the template.
 * Matching is by idShort, recursively through collection children.
 */
export function checkSubmodelAgainstTemplate(
  sm: SubmodelTemplate,
  tpl: SubmodelTemplate,
  smPath: string,
): { errors: ValidationFinding[]; warnings: ValidationFinding[] } {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];

  const walk = (tplEls: SubmodelElement[], smEls: SubmodelElement[], prefix: string) => {
    const byIdShort = new Map(smEls.filter(e => e.idShort).map(e => [e.idShort, e]));
    for (const tplEl of tplEls) {
      if (!tplEl.idShort) continue;
      const match = byIdShort.get(tplEl.idShort);
      const p = `${prefix} → ${tplEl.idShort}`;
      if (!match) {
        if (tplEl.required) {
          errors.push({
            path: p,
            msg: `Elemento obbligatorio del template "${tpl.idShort}" mancante`,
            rule: 'TPL-001',
          });
        }
        continue;
      }
      if (match.type !== tplEl.type) {
        warnings.push({
          path: p,
          msg: `Tipo diverso dal template: ${match.type} invece di ${tplEl.type}`,
          rule: 'TPL-002',
        });
        continue;
      }
      if (tplEl.type === 'SubmodelElementCollection' && tplEl.children?.length) {
        walk(tplEl.children, match.children ?? [], p);
      }
    }
  };

  walk(tpl.elements ?? [], sm.elements ?? [], smPath);
  return { errors, warnings };
}
