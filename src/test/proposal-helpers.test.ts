import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, SERVICE_TYPES, type ProposalItem } from "@/contexts/ProposalsContext";

// Helper functions extracted for testing
// These mirror the logic in ProposalsContext

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por hífen
    .replace(/^-+|-+$/g, "") // Remove hífens do início e fim
    .substring(0, 30); // Limita tamanho
}

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function calculateTotal(items: ProposalItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

describe("generateSlug", () => {
  it("should convert name to lowercase slug", () => {
    expect(generateSlug("João Silva")).toBe("joao-silva");
  });

  it("should remove accents", () => {
    expect(generateSlug("José André")).toBe("jose-andre");
    expect(generateSlug("Conceição")).toBe("conceicao");
  });

  it("should replace special characters with hyphens", () => {
    expect(generateSlug("Maria & José")).toBe("maria-jose");
    expect(generateSlug("Cliente (Novo)")).toBe("cliente-novo");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(generateSlug("  Maria  ")).toBe("maria");
    expect(generateSlug("---João---")).toBe("joao");
  });

  it("should limit to 30 characters", () => {
    const longName = "Empresa de Jardinagem e Paisagismo do Brasil Ltda";
    const result = generateSlug(longName);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("should handle empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("should handle numbers", () => {
    expect(generateSlug("Cliente 123")).toBe("cliente-123");
  });
});

describe("isUUID", () => {
  it("should validate correct UUID v4", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("should reject invalid UUIDs", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("joao-silva")).toBe(false);
    expect(isUUID("123456")).toBe(false);
    expect(isUUID("")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isUUID("550e8400-E29B-41d4-a716-446655440000")).toBe(true);
  });

  it("should reject UUIDs with wrong format", () => {
    expect(isUUID("550e8400e29b41d4a716446655440000")).toBe(false); // No hyphens
    expect(isUUID("550e8400-e29b-41d4-a716-44665544000")).toBe(false); // Too short
    expect(isUUID("550e8400-e29b-41d4-a716-4466554400000")).toBe(false); // Too long
  });
});

describe("calculateTotal", () => {
  it("should calculate total for single item", () => {
    const items: ProposalItem[] = [
      { id: "1", name: "Planta", description: "", quantity: 2, unitPrice: 50 },
    ];
    expect(calculateTotal(items)).toBe(100);
  });

  it("should calculate total for multiple items", () => {
    const items: ProposalItem[] = [
      { id: "1", name: "Planta A", description: "", quantity: 3, unitPrice: 100 },
      { id: "2", name: "Planta B", description: "", quantity: 2, unitPrice: 75 },
      { id: "3", name: "Mão de obra", description: "", quantity: 1, unitPrice: 500 },
    ];
    expect(calculateTotal(items)).toBe(950); // (3*100) + (2*75) + (1*500)
  });

  it("should return 0 for empty array", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("should handle decimal prices", () => {
    const items: ProposalItem[] = [
      { id: "1", name: "Item", description: "", quantity: 3, unitPrice: 19.90 },
    ];
    expect(calculateTotal(items)).toBeCloseTo(59.70, 2);
  });

  it("should handle zero quantity", () => {
    const items: ProposalItem[] = [
      { id: "1", name: "Item", description: "", quantity: 0, unitPrice: 100 },
    ];
    expect(calculateTotal(items)).toBe(0);
  });
});

describe("PLAN_LIMITS", () => {
  it("should have correct limits for free plan", () => {
    expect(PLAN_LIMITS.free.proposalsPerMonth).toBe(0);
  });

  it("should have correct limits for essential plan", () => {
    expect(PLAN_LIMITS.essential.proposalsPerMonth).toBe(30);
  });

  it("should have unlimited proposals for pro plan", () => {
    expect(PLAN_LIMITS.pro.proposalsPerMonth).toBe(Infinity);
  });

  it("should have all expected plans defined", () => {
    expect(PLAN_LIMITS).toHaveProperty("free");
    expect(PLAN_LIMITS).toHaveProperty("essential");
    expect(PLAN_LIMITS).toHaveProperty("pro");
  });
});

describe("SERVICE_TYPES", () => {
  it("should have manutencao type", () => {
    expect(SERVICE_TYPES.manutencao).toEqual({
      label: "Manutenção",
      icon: "wrench",
    });
  });

  it("should have outro type", () => {
    expect(SERVICE_TYPES.outro).toEqual({
      label: "Outro",
      icon: "clipboard-list",
    });
  });

  it("should expose generic service categories", () => {
    expect(Object.keys(SERVICE_TYPES)).toContain("servico");
    expect(Object.keys(SERVICE_TYPES)).toContain("manutencao");
    expect(Object.keys(SERVICE_TYPES)).toContain("instalacao");
    expect(Object.keys(SERVICE_TYPES)).toContain("reparo");
    expect(Object.keys(SERVICE_TYPES)).toContain("consultoria");
    expect(Object.keys(SERVICE_TYPES)).toContain("outro");
  });
});
