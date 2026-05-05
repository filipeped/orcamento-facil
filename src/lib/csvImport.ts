// Parser de CSV simples — suporta aspas, vírgulas dentro de campos quotados, escapes "".
// Sem dependência externa.

export type CsvRow = Record<string, string>;

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  errors: string[];
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      result.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  result.push(current);
  return result.map((s) => s.trim());
}

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  // Normaliza line endings e remove BOM
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: ["CSV vazio"] };

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 0) continue;
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows, errors };
}

// ============================================
// Mapeamento Cliente: aceita PT e EN nas headers (compat com sample_files do Invoice Fly).
// Headers esperadas (case-insensitive):
//   PT: Nome, Email, Telefone, Endereço, CNPJ/CPF, Observações
//   EN: Client/Name, Email, Phone, Address, Id number/Tax ID, Notes
// ============================================
export interface ImportedClient {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const CLIENT_HEADER_MAP = {
  name: ["nome", "name", "client", "cliente"],
  email: ["email", "e-mail", "primary email"],
  phone: ["telefone", "phone", "celular", "primary phone"],
  address: ["endereço", "endereco", "address"],
  notes: ["observações", "observacoes", "notas", "notes"],
};

function pickField(row: CsvRow, candidates: string[]): string {
  for (const candidate of candidates) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim() === candidate.toLowerCase()) {
        return (row[key] || "").trim();
      }
    }
  }
  return "";
}

export function mapCsvToClients(rows: CsvRow[]): { valid: ImportedClient[]; invalid: { row: CsvRow; reason: string }[] } {
  const valid: ImportedClient[] = [];
  const invalid: { row: CsvRow; reason: string }[] = [];
  for (const row of rows) {
    const name = pickField(row, CLIENT_HEADER_MAP.name);
    if (!name) {
      invalid.push({ row, reason: "Nome em branco" });
      continue;
    }
    valid.push({
      name,
      email: pickField(row, CLIENT_HEADER_MAP.email),
      phone: pickField(row, CLIENT_HEADER_MAP.phone),
      address: pickField(row, CLIENT_HEADER_MAP.address),
      notes: pickField(row, CLIENT_HEADER_MAP.notes),
    });
  }
  return { valid, invalid };
}

// ============================================
// Mapeamento Item: aceita PT e EN.
// Headers esperadas (case-insensitive):
//   PT: Nome, Descrição, Preço, Unidade, Categoria
//   EN: Item/Name, Description, Price, Unit, Category, Days or Hours
// ============================================
export interface ImportedItem {
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
}

const ITEM_HEADER_MAP = {
  name: ["nome", "name", "item"],
  description: ["descrição", "descricao", "description"],
  price: ["preço", "preco", "price", "valor"],
  unit: ["unidade", "unit", "days or hours"],
  category: ["categoria", "category"],
};

function parsePriceBR(v: string): number {
  if (!v) return 0;
  // Aceita "1.234,56" (BR) e "1234.56" (US). Remove "R$", espaços.
  const cleaned = v.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  // Se tem vírgula, assume BR (vírgula = decimal). Se só tem ponto, assume US.
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function normalizeUnit(v: string): string {
  if (!v) return "un";
  const lower = v.toLowerCase().trim();
  if (lower === "hours" || lower === "horas" || lower === "hora" || lower === "hr") return "hr";
  if (lower === "days" || lower === "dias" || lower === "dia") return "dia";
  if (lower === "none" || lower === "unidade") return "un";
  if (lower === "m²" || lower === "m2" || lower === "metro quadrado") return "m²";
  if (lower === "m³" || lower === "m3") return "m³";
  return v.trim();
}

export function mapCsvToItems(rows: CsvRow[]): { valid: ImportedItem[]; invalid: { row: CsvRow; reason: string }[] } {
  const valid: ImportedItem[] = [];
  const invalid: { row: CsvRow; reason: string }[] = [];
  for (const row of rows) {
    const name = pickField(row, ITEM_HEADER_MAP.name);
    if (!name) {
      invalid.push({ row, reason: "Nome em branco" });
      continue;
    }
    valid.push({
      name,
      description: pickField(row, ITEM_HEADER_MAP.description),
      price: parsePriceBR(pickField(row, ITEM_HEADER_MAP.price)),
      unit: normalizeUnit(pickField(row, ITEM_HEADER_MAP.unit)),
      category: pickField(row, ITEM_HEADER_MAP.category) || "Serviços",
    });
  }
  return { valid, invalid };
}
