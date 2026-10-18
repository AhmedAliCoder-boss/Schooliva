import { afterEach, describe, expect, it, vi } from "vitest";

import { retryReadFetch } from "../../src/lib/supabase/retry-read-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retryReadFetch", () => {
  it("retries transient read network errors", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await retryReadFetch("https://schooliva.example/rest/v1/students");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient server responses, then returns the successful response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await retryReadFetch("https://schooliva.example/rest/v1/students");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry writes", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryReadFetch("https://schooliva.example/rest/v1/students", { method: "POST" }))
      .rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry aborted requests", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryReadFetch("https://schooliva.example/rest/v1/students"))
      .rejects.toThrow("Aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
