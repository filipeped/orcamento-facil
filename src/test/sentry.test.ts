import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Sentry before importing the module
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
}));

// Mock import.meta.env
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_SENTRY_DSN: "",
      MODE: "test",
    },
  },
});

describe("Sentry helpers (without DSN)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module to test without DSN
    vi.resetModules();
  });

  it("should not initialize sentry when DSN is not set", async () => {
    const Sentry = await import("@sentry/react");
    const { initSentry } = await import("@/lib/sentry");

    initSentry();

    // Should not call init when DSN is empty
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("should not capture errors when DSN is not set", async () => {
    const Sentry = await import("@sentry/react");
    const { captureError } = await import("@/lib/sentry");

    const error = new Error("Test error");
    captureError(error);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("should not add breadcrumb when DSN is not set", async () => {
    const Sentry = await import("@sentry/react");
    const { addBreadcrumb } = await import("@/lib/sentry");

    addBreadcrumb("Test message", "test");

    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it("should not set user when DSN is not set", async () => {
    const Sentry = await import("@sentry/react");
    const { setUser } = await import("@/lib/sentry");

    setUser("user-123", "test@example.com", "Test User");

    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it("should not clear user when DSN is not set", async () => {
    const Sentry = await import("@sentry/react");
    const { clearUser } = await import("@/lib/sentry");

    clearUser();

    expect(Sentry.setUser).not.toHaveBeenCalled();
  });
});

describe("Sentry configuration", () => {
  it("should export initSentry function", async () => {
    const { initSentry } = await import("@/lib/sentry");
    expect(typeof initSentry).toBe("function");
  });

  it("should export captureError function", async () => {
    const { captureError } = await import("@/lib/sentry");
    expect(typeof captureError).toBe("function");
  });

  it("should export addBreadcrumb function", async () => {
    const { addBreadcrumb } = await import("@/lib/sentry");
    expect(typeof addBreadcrumb).toBe("function");
  });

  it("should export setUser function", async () => {
    const { setUser } = await import("@/lib/sentry");
    expect(typeof setUser).toBe("function");
  });

  it("should export clearUser function", async () => {
    const { clearUser } = await import("@/lib/sentry");
    expect(typeof clearUser).toBe("function");
  });

  it("should export Sentry object", async () => {
    const { Sentry } = await import("@/lib/sentry");
    expect(Sentry).toBeDefined();
  });
});
