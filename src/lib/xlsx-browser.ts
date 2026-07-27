"use client";

/**
 * Lecture de fichiers .xlsx côté navigateur, sans dépendance externe.
 * S'appuie sur les API natives du navigateur (DecompressionStream pour
 * l'inflate DEFLATE d'un ZIP, DOMParser pour le XML OOXML) plutôt que sur
 * une librairie comme SheetJS/exceljs — même logique que `lib/xlsx.ts`
 * côté serveur : éviter d'ajouter des CVEs ou une longue chaîne de
 * dépendances pour lire quelques colonnes fixes.
 */

type ZipEntry = { method: number; compSize: number; uncompSize: number; localOffset: number };

function findEndOfCentralDirectory(view: DataView): number {
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error("Fichier ZIP invalide (fin de répertoire central introuvable)");
}

function readCentralDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i++) {
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, ptr + 46, nameLen));

    entries.set(name, { method, compSize, uncompSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

async function inflate(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes;
  if (method !== 8) throw new Error("Méthode de compression ZIP non supportée");

  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function extractPart(buffer: ArrayBuffer, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;

  const view = new DataView(buffer);
  const localNameLen = view.getUint16(entry.localOffset + 26, true);
  const localExtraLen = view.getUint16(entry.localOffset + 28, true);
  const dataStart = entry.localOffset + 30 + localNameLen + localExtraLen;
  const compressed = new Uint8Array(buffer, dataStart, entry.compSize);
  const raw = await inflate(compressed, entry.method);
  return new TextDecoder("utf-8").decode(raw);
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function textContent(el: Element | null): string {
  if (!el) return "";
  return Array.from(el.getElementsByTagName("t"))
    .map((t) => t.textContent ?? "")
    .join("");
}

/** Parse un fichier .xlsx (1ère feuille) en lignes d'objets, comme `parseCsv`. */
export async function parseXlsxFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const entries = readCentralDirectory(buffer);

  const sharedStringsXml = await extractPart(buffer, entries, "xl/sharedStrings.xml");
  const parser = new DOMParser();
  const sharedStrings: string[] = sharedStringsXml
    ? Array.from(parser.parseFromString(sharedStringsXml, "application/xml").getElementsByTagName("si")).map(
        textContent
      )
    : [];

  const workbookXml = await extractPart(buffer, entries, "xl/workbook.xml");
  const workbookRelsXml = await extractPart(buffer, entries, "xl/_rels/workbook.xml.rels");
  let sheetPath = "xl/worksheets/sheet1.xml";

  if (workbookXml && workbookRelsXml) {
    const wb = parser.parseFromString(workbookXml, "application/xml");
    const firstSheet = wb.getElementsByTagName("sheet")[0];
    const rId = firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    if (rId) {
      const rels = parser.parseFromString(workbookRelsXml, "application/xml");
      const rel = Array.from(rels.getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rId);
      const target = rel?.getAttribute("Target");
      if (target) sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
    }
  }

  const sheetXml = await extractPart(buffer, entries, sheetPath);
  if (!sheetXml) throw new Error("Feuille de calcul introuvable dans le fichier.");

  const sheet = parser.parseFromString(sheetXml, "application/xml");
  const rowsEls = Array.from(sheet.getElementsByTagName("row"));

  const grid: string[][] = rowsEls.map((rowEl) => {
    const cells: string[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") ?? "";
      const col = ref ? columnIndexFromRef(ref) : cells.length;
      const type = c.getAttribute("t");
      let value = "";

      if (type === "inlineStr") {
        value = textContent(c.getElementsByTagName("is")[0] ?? null);
      } else {
        const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
        value = type === "s" ? sharedStrings[Number(v)] ?? "" : v;
      }

      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    return cells;
  });

  const nonEmptyRows = grid.filter((r) => r.some((cell) => cell.trim() !== ""));
  const [header, ...dataRows] = nonEmptyRows;
  if (!header) return [];

  return dataRows.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), (cells[i] ?? "").trim()]))
  );
}
