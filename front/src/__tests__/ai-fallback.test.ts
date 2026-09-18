jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => (model: string) => ({ modelId: model })),
}));

import {
  isCommandCodeConfigured,
  getChatModel,
  getCommandCodeModel,
  CHAT_MODEL,
  VISION_MODEL,
} from "@/lib/ai";

describe("AI GOAT Provider Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("correctly identifies when CommandCode is configured", () => {
    process.env.COMMANDCODE_API_KEY = "test-key";
    expect(isCommandCodeConfigured()).toBe(true);

    delete process.env.COMMANDCODE_API_KEY;
    expect(isCommandCodeConfigured()).toBe(false);
  });

  test("defaults to contributor model", () => {
    expect(CHAT_MODEL).toBe(
      process.env.DEFAULT_AGENT_MODEL || process.env.COMMANDCODE_MODEL || "meta/muse-spark-1.3-contributor"
    );
  });

  test("exposes a GOAT vision model", () => {
    expect(VISION_MODEL).toBe(process.env.VISION_MODEL || "deepseek/deepseek-v4.1-flash");
  });

  test("getChatModel returns the CommandCode GOAT model", () => {
    process.env.COMMANDCODE_API_KEY = "cc-key";
    const model = getChatModel();
    expect(model).toBeDefined();
    expect(model.modelId).toBe(CHAT_MODEL);
  });

  test("getCommandCodeModel resolves explicit model ids", () => {
    const model = getCommandCodeModel("deepseek/deepseek-v4-flash");
    expect(model).toBeDefined();
    expect(model.modelId).toBe("deepseek/deepseek-v4-flash");
  });
});
