// ─────────────────────────────────────────────────────────────────────────────
// Real AASX export (IDTA Part 5): an OPC package (zip) with the standard
// relationship chain  /_rels/.rels → /aasx/aasx-origin → /aasx/data.json.
// The JSON payload is the same environment used for validation/JSON export.
// ─────────────────────────────────────────────────────────────────────────────

import JSZip from 'jszip';
import type { IDTAEnvironment } from '@/utils/aas-builder';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES = `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Override PartName="/aasx/aasx-origin" ContentType="text/plain"/>
</Types>`;

const ROOT_RELS = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://admin-shell.io/aasx/relationships/aasx-origin" Target="/aasx/aasx-origin" Id="r-aasx-origin"/>
</Relationships>`;

const ORIGIN_RELS = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://admin-shell.io/aasx/relationships/aas-spec" Target="/aasx/data.json" Id="r-aas-spec"/>
</Relationships>`;

/** Build a .aasx package blob for the given environment. */
export async function buildAasxBlob(env: IDTAEnvironment): Promise<Blob> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('aasx/aasx-origin', 'Intentionally empty.');
  zip.file('aasx/_rels/aasx-origin.rels', ORIGIN_RELS);
  zip.file('aasx/data.json', JSON.stringify(env, null, 2));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/asset-administration-shell-package',
    compression: 'DEFLATE',
  });
}
