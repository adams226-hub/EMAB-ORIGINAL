import { deflateRawSync } from "node:zlib";

/**
 * Générateur .xlsx minimal (ZIP + OOXML), sans dépendance externe.
 * Les bibliothèques usuelles (`xlsx`/SheetJS, `exceljs`) tirent des CVEs
 * non corrigées ou une longue chaîne de dépendances transitives
 * (archiver/uuid/glob...) pour un besoin qui reste : quelques feuilles
 * de calcul à colonnes fixes générées côté serveur à partir de nos
 * propres données. Même logique que `lib/csv.ts`.
 */

function xmlEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

// Styles déclarés dans xl/styles.xml (cellXfs, index = ordre de déclaration) :
// 0 = normal, 1 = normal + milliers (#,##0), 2 = gras, 3 = gras + milliers.
const STYLE_NORMAL = 0;
const STYLE_NUMBER = 1;
const STYLE_BOLD = 2;
const STYLE_BOLD_NUMBER = 3;

function styleFor(numberFormat: boolean | undefined, bold: boolean): number {
  if (bold) return numberFormat ? STYLE_BOLD_NUMBER : STYLE_BOLD;
  return numberFormat ? STYLE_NUMBER : STYLE_NORMAL;
}

function buildSheetXml<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string; numberFormat?: boolean }[],
  boldRows: Set<number>
): string {
  const headerCells = columns
    .map(
      (c, i) =>
        `<c r="${columnLetter(i)}1" t="inlineStr" s="${STYLE_BOLD}"><is><t>${xmlEscape(c.label)}</t></is></c>`
    )
    .join("");

  const dataRows = rows
    .map((row, r) => {
      const bold = boldRows.has(r);
      const cells = columns
        .map((c, i) => {
          const ref = `${columnLetter(i)}${r + 2}`;
          const value = row[c.key];
          const s = styleFor(c.numberFormat, bold);
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}" s="${s}"><v>${value}</v></c>`;
          }
          if (value === null || value === undefined || value === "") {
            return `<c r="${ref}" s="${s}"/>`;
          }
          return `<c r="${ref}" t="inlineStr" s="${s}"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData><row r="1">${headerCells}</row>${dataRows}</sheetData>` +
    "</worksheet>"
  );
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    overrides +
    "</Types>"
  );
}

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets}</sheets>` +
    "</workbook>"
  );
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join("");

  const stylesRel = `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    stylesRel +
    "</Relationships>"
  );
}

// numFmtId 3 = "#,##0" (format intégré OOXML) : Excel affiche le séparateur
// de milliers propre à la locale de l'utilisateur (espace en français).
const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  "</cellXfs>" +
  "</styleSheet>";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Empaquette des fichiers en un ZIP minimal (méthode DEFLATE), sans dépendance. */
function buildZip(files: { name: string; content: string }[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf-8");
    const rawBuf = Buffer.from(file.content, "utf-8");
    const compressedBuf = deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);
    const flag = 0x0800; // noms de fichiers en UTF-8

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(flag, 6);
    localHeader.writeUInt16LE(8, 8); // DEFLATE
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, compressedBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(flag, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressedBuf.length;
  }

  const centralDirSize = centralChunks.reduce((sum, b) => sum + b.length, 0);
  const centralDirOffset = offset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

export interface XlsxColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  key: keyof T;
  label: string;
  /** Applique le format milliers (#,##0) aux valeurs numériques de cette colonne. */
  numberFormat?: boolean;
}

export interface XlsxSheet<T extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  rows: T[];
  columns: XlsxColumn<T>[];
  /** Index (0-based, dans `rows`) des lignes à afficher en gras — ex. une ligne de total. */
  boldRows?: number[];
}

/** Génère un classeur .xlsx à plusieurs feuilles à partir de lignes d'objets. */
export function toXlsxMulti(sheets: XlsxSheet[]): Buffer {
  const files = [
    { name: "[Content_Types].xml", content: contentTypesXml(sheets.length) },
    { name: "_rels/.rels", content: ROOT_RELS_XML },
    { name: "xl/workbook.xml", content: workbookXml(sheets.map((s) => s.name)) },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml(sheets.length) },
    { name: "xl/styles.xml", content: STYLES_XML },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildSheetXml(s.rows, s.columns, new Set(s.boldRows ?? [])),
    })),
  ];
  return buildZip(files);
}

/** Génère un classeur .xlsx à une feuille à partir de lignes d'objets. */
export function toXlsx<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string; numberFormat?: boolean }[],
  sheetName = "Feuille1"
): Buffer {
  return toXlsxMulti([{ name: sheetName, rows, columns: columns as unknown as XlsxSheet["columns"] }]);
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
