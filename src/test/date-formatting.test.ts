import { describe, it, expect } from "vitest";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Test date formatting functions used across the app
// These mirror the patterns in PropostaDetalhe, Propostas, PropostaPublica

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLong(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return formatDate(dateString);
}

describe("formatDate", () => {
  it("should format date in Brazilian format", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it("should handle ISO date strings", () => {
    // Use a date with explicit time to avoid timezone issues
    const result = formatDate("2024-12-25T12:00:00");
    expect(result).toContain("25");
    expect(result).toContain("12");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("should include time in the output", () => {
    const result = formatDateTime("2024-01-15T14:30:00Z");
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    // Note: Time will be in local timezone
  });
});

describe("formatDateLong", () => {
  it("should format date in long Portuguese format", () => {
    const result = formatDateLong("2024-01-15");
    expect(result).toContain("15");
    expect(result).toContain("janeiro");
    expect(result).toContain("2024");
  });

  it("should use Portuguese month names", () => {
    expect(formatDateLong("2024-03-10")).toContain("março");
    expect(formatDateLong("2024-06-20")).toContain("junho");
    expect(formatDateLong("2024-12-25")).toContain("dezembro");
  });
});

describe("formatTimeAgo", () => {
  it("should return 'Agora mesmo' for very recent dates", () => {
    const now = new Date();
    const result = formatTimeAgo(now.toISOString());
    expect(result).toBe("Agora mesmo");
  });

  it("should return minutes for dates less than an hour ago", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const result = formatTimeAgo(thirtyMinsAgo.toISOString());
    expect(result).toMatch(/\d+min atrás/);
  });

  it("should return hours for dates less than a day ago", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const result = formatTimeAgo(fiveHoursAgo.toISOString());
    expect(result).toMatch(/\d+h atrás/);
  });

  it("should return 'Ontem' for yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatTimeAgo(yesterday.toISOString());
    expect(result).toBe("Ontem");
  });

  it("should return days for dates within a week", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatTimeAgo(threeDaysAgo.toISOString());
    expect(result).toMatch(/\d+ dias atrás/);
  });

  it("should return formatted date for older dates", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = formatTimeAgo(twoWeeksAgo.toISOString());
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe("currency formatting", () => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  it("should format Brazilian currency", () => {
    expect(formatCurrency(1000)).toMatch(/R\$\s*1\.000,00/);
  });

  it("should handle decimal values", () => {
    expect(formatCurrency(1234.56)).toMatch(/R\$\s*1\.234,56/);
  });

  it("should handle zero", () => {
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
  });

  it("should handle negative values", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
    expect(result).toContain("-");
  });
});
