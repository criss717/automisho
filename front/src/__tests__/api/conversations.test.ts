/**
 * Tests for conversation plan limits logic.
 */

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  premium: 20,
  pro: Infinity,
};

function canCreateConversation(plan: string, currentCount: number): {
  allowed: boolean;
  limit: number;
  remaining: number | string;
} {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const allowed = currentCount < limit;
  const remaining = limit === Infinity ? "unlimited" : Math.max(0, limit - currentCount);
  return { allowed, limit, remaining };
}

describe("Conversation Plan Limits", () => {
  describe("free plan", () => {
    it("allows creation when under limit", () => {
      const result = canCreateConversation("free", 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("blocks creation at limit", () => {
      const result = canCreateConversation("free", 5);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("blocks creation over limit", () => {
      const result = canCreateConversation("free", 10);
      expect(result.allowed).toBe(false);
    });

    it("allows creation at 0", () => {
      const result = canCreateConversation("free", 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });

  describe("premium plan", () => {
    it("allows creation when under limit", () => {
      const result = canCreateConversation("premium", 15);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it("blocks creation at limit", () => {
      const result = canCreateConversation("premium", 20);
      expect(result.allowed).toBe(false);
    });
  });

  describe("pro plan", () => {
    it("always allows creation", () => {
      const result = canCreateConversation("pro", 100);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe("unlimited");
    });

    it("allows creation at any count", () => {
      const result = canCreateConversation("pro", 999999);
      expect(result.allowed).toBe(true);
    });
  });

  describe("unknown plan", () => {
    it("defaults to free plan limits", () => {
      const result = canCreateConversation("unknown", 3);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
    });
  });
});
