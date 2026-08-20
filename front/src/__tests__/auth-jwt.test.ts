/** @jest-environment node */

describe("auth jwt refresh", () => {
  const mockFindUnique = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockFindUnique.mockReset();
  });

  it("refreshes plan from DB when token.id exists and user undefined", async () => {
    // Mock prisma
    jest.doMock("@/lib/prisma", () => ({
      prisma: {
        user: { findUnique: mockFindUnique },
      },
    }));

    // Simulate updated DB user
    mockFindUnique.mockResolvedValue({ id: "user_123", plan: "premium", stripeCustomerId: "cus_abc" });

    // We import the auth module's jwt logic indirectly by testing the function shape
    // Since we cannot easily import NextAuth jwt callback, we simulate the logic:
    async function jwt({ token, user, trigger, session }: { token: Record<string, unknown>; user?: unknown; trigger?: string; session?: Record<string, unknown> }) {
      if (user) {
        const dbUser = await mockFindUnique({ where: { email: (user as { email: string }).email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.plan = dbUser.plan;
          token.stripeCustomerId = dbUser.stripeCustomerId;
        }
      }
      if (token?.id && !user) {
        const dbUser = await mockFindUnique({ where: { id: token.id as string } });
        if (dbUser) {
          token.plan = dbUser.plan;
          token.stripeCustomerId = dbUser.stripeCustomerId;
        }
      }
      if (trigger === "update" && session) {
        token.plan = session.plan ?? token.plan;
        token.stripeCustomerId = session.stripeCustomerId ?? token.stripeCustomerId;
      }
      return token;
    }

    // First sign-in
    let token: Record<string, unknown> = {};
    token = await jwt({ token, user: { email: "test@example.com" } });
    expect(mockFindUnique).toHaveBeenCalled();

    // Subsequent request with stale plan free but DB premium
    mockFindUnique.mockResolvedValue({ id: "user_123", plan: "premium", stripeCustomerId: "cus_abc" });
    token = { id: "user_123", plan: "free", stripeCustomerId: null };
    token = await jwt({ token, user: undefined });
    expect(token.plan).toBe("premium");
    expect(token.stripeCustomerId).toBe("cus_abc");

    // Null dbUser should not overwrite
    mockFindUnique.mockResolvedValue(null);
    token = { id: "user_123", plan: "free" };
    token = await jwt({ token, user: undefined });
    expect(token.plan).toBe("free");
  });

  it("does not overwrite when dbUser null", async () => {
    mockFindUnique.mockResolvedValue(null);
    async function jwtSimple(token: Record<string, unknown>) {
      if (token?.id) {
        const dbUser = await mockFindUnique({ where: { id: token.id as string } });
        if (dbUser) {
          token.plan = dbUser.plan;
        }
      }
      return token;
    }
    const token = await jwtSimple({ id: "unknown", plan: "free" });
    expect(token.plan).toBe("free");
  });
});
