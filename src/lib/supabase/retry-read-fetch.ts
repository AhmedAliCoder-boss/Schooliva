const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const maxAttempts = 3;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableNetworkError(error: unknown) {
  return error instanceof TypeError;
}

export async function retryReadFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") return fetch(input, init);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!retryableStatuses.has(response.status) || attempt === maxAttempts) return response;
      await response.body?.cancel();
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt === maxAttempts) throw error;
    }
    await wait(150 * attempt);
  }

  throw new Error("Supabase read request exhausted its retry attempts.");
}
