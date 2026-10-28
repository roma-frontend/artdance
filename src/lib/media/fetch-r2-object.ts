// r2.dev ограничен по частоте и не предназначен для продакшена: повторяем временные зависания.
export interface FetchR2Options {
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

export async function fetchR2Object(
  url: string,
  label: string,
  options: FetchR2Options = {},
): Promise<Buffer> {
  const { attempts = 4, timeoutMs = 30_000, backoffMs = 2_000 } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt - 1)));
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`R2 GET ${label} failed after ${attempts} attempts: ${String(lastError)}`);
}
