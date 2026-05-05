// Helper de export CSV — abre direto no Excel/Numbers/LibreOffice.
// Sem dep externa.

function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  // Se contém vírgula, aspas ou quebra de linha, envolve em aspas e escapa aspas duplicando
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (rows.length === 0) {
    return;
  }

  const cols = columns || (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })));
  const headerLine = cols.map((c) => escapeCsvField(c.label)).join(",");
  const dataLines = rows.map((row) =>
    cols.map((c) => escapeCsvField(row[c.key])).join(",")
  );

  // BOM UTF-8 pra Excel reconhecer acentos
  const csv = "﻿" + [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helpers de formato BR
export function formatCsvCurrency(value: number | null | undefined): string {
  if (value == null) return "";
  return value.toFixed(2).replace(".", ",");
}

export function formatCsvDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}
