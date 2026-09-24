import { afterEach, describe, expect, it, vi } from "vitest";

import { ProxyClient } from "./config";

describe("AI client transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends proxy requests with browser credentials and without an AI bearer token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "test-response", output: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProxyClient();
    client.ensureConfigured({
      apiBase: "http://localhost:8000/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5.5",
      credentials: "include",
    });

    await client.openai.responses.create({ model: "gpt-5.5", input: "Hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/experimental/ai/v1/responses",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("authorization"),
    ).toBe(false);
  });

  it("uses the personal key again after switching back to a custom provider", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: "test-response", output: [] }), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProxyClient();
    client.ensureConfigured({
      apiBase: "http://localhost:8000/api/experimental/ai/v1",
      apiKey: "",
      model: "gpt-5.5",
      credentials: "include",
    });
    client.ensureConfigured({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-5.5",
    });

    await client.openai.responses.create({ model: "gpt-5.5", input: "Hello" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.com/v1/responses",
    );
    expect(fetchMock.mock.calls[0][1]?.credentials).not.toBe("include");
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization"),
    ).toBe("Bearer sk-personal");
  });
});
