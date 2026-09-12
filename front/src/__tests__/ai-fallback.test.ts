jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => (model: string) => ({ modelId: model })),
}));

jest.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: jest.fn(() => (model: string) => ({ modelId: model })),
}));

jest.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: jest.fn(() => (model: string) => ({ modelId: model })),
}));

import {
  isOpenCodeConfigured,
  isGeminiConfigured,
  getChatModel,
  CHAT_MODEL,
  GEMINI_MODEL,
} from "@/lib/ai";

describe("AI Dual Provider & Fallback Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("correctly identifies when OpenCode is configured", () => {
    process.env.OPENCODE_API_KEY = "test-key";
    process.env.OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";
    expect(isOpenCodeConfigured()).toBe(true);

    delete process.env.OPENCODE_API_KEY;
    expect(isOpenCodeConfigured()).toBe(false);
  });

  test("correctly identifies when Gemini is configured", () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    expect(isGeminiConfigured()).toBe(true);

    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);
  });

  test("defaults to OpenCode model when OpenCode is configured", () => {
    process.env.OPENCODE_API_KEY = "opencode-key";
    process.env.OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";
    const model = getChatModel();
    expect(model).toBeDefined();
    expect(model.modelId).toBe(CHAT_MODEL);
  });

  test("falls back to Google Gemini when OpenCode is not configured but Gemini is", () => {
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_BASE_URL;
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const model = getChatModel();
    expect(model).toBeDefined();
    expect(model.modelId).toBe(GEMINI_MODEL);
  });
});
