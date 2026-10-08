import type { APIRequestContext } from '@playwright/test';
import { z, type ZodType } from 'zod';
import { redact } from '@core/utils/redact';
import { step } from '@core/utils/step';

export interface ApiRequestOptions<T = unknown> {
  /** JSON body (objects are sent as JSON). */
  data?: unknown;
  /** Query string parameters. */
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  /** Expected status. Default: any 2xx; anything else fails the step with the response body. */
  expectStatus?: number;
  /**
   * Contract of the response body (a zod schema, usually from apps/<app>/models/api/). The body is
   * checked against it and returned typed; a missing field or wrong type fails the step with the differences.
   */
  schema?: ZodType<T>;
  /** Fail when the response takes longer than this many milliseconds. */
  maxMs?: number;
  /** HTML form body (application/x-www-form-urlencoded), instead of `data`. */
  form?: Record<string, string | number | boolean>;
  /**
   * Multipart body (file uploads), instead of `data`. Files: `{ name, mimeType, buffer }`.
   * @example multipart: { title: 'Invoice', file: { name: 'a.pdf', mimeType: 'application/pdf', buffer } }
   */
  multipart?: Record<string, string | number | boolean | { name: string; mimeType: string; buffer: Buffer }>;
  /** Give up after this many milliseconds (default: Playwright's 30 s). */
  timeout?: number;
  /**
   * Try again this many times when the server is briefly unavailable (502 / 503 / 504 or no connection).
   * For setup and cleanup calls on shaky QA servers; a check of the API itself should not retry.
   */
  retries?: number;
}

/** Statuses that mean "the server is briefly unavailable", worth another try. */
const RETRY_STATUSES = [502, 503, 504];

export interface ApiResponse<T> {
  status: number;
  headers: Record<string, string>;
  body: T;
  /** Response time in milliseconds. */
  ms: number;
}

/**
 * Small REST client for API tests (tests/api) and for test setup / cleanup.
 * Base URL and auth headers come from the app config / .env (API_BASE_URL, API_TOKEN).
 *
 * @example
 *   const { body } = await api.post('/api/v1/customers', { data: customer, schema: CustomerSchema });
 *   cleanup.add(`Delete customer ${body.id}`, () => api.delete(`/api/v1/customers/${body.id}`));
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  get<T = unknown>(url: string, options?: ApiRequestOptions<T>) {
    return this.send<T>('GET', url, options);
  }
  post<T = unknown>(url: string, options?: ApiRequestOptions<T>) {
    return this.send<T>('POST', url, options);
  }
  put<T = unknown>(url: string, options?: ApiRequestOptions<T>) {
    return this.send<T>('PUT', url, options);
  }
  patch<T = unknown>(url: string, options?: ApiRequestOptions<T>) {
    return this.send<T>('PATCH', url, options);
  }
  delete<T = unknown>(url: string, options?: ApiRequestOptions<T>) {
    return this.send<T>('DELETE', url, options);
  }

  /** The request, tried again (1 s, 2 s, ...) while the server answers 502/503/504 or can't be reached. */
  private async fetchWithRetries<T>(method: string, url: string, options: ApiRequestOptions<T>) {
    const retries = options.retries ?? 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.request.fetch(url, {
          method,
          data: options.data,
          form: options.form,
          multipart: options.multipart,
          params: options.params,
          headers: options.headers,
          timeout: options.timeout,
        });
        if (attempt < retries && RETRY_STATUSES.includes(response.status())) {
          await delay(1000 * (attempt + 1));
          continue;
        }
        return response;
      } catch (error) {
        if (attempt >= retries) throw error;
        await delay(1000 * (attempt + 1));
      }
    }
  }

  private send<T>(method: string, url: string, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
    return step(`API ${method} ${url}`, async () => {
      const started = Date.now();
      const response = await this.fetchWithRetries(method, url, options);
      const text = await response.text();
      const ms = Date.now() - started;
      const status = response.status();
      const ok = options.expectStatus !== undefined ? status === options.expectStatus : response.ok();
      if (!ok) {
        const expected = options.expectStatus ?? '2xx';
        throw new Error(redact(`${method} ${url} returned ${status} (expected ${expected}): ${text.slice(0, 500)}`));
      }
      if (options.maxMs !== undefined && ms > options.maxMs) {
        throw new Error(`${method} ${url} took ${ms} ms (limit ${options.maxMs} ms)`);
      }
      let body = parseBody(text);
      if (options.schema) {
        const result = options.schema.safeParse(body);
        if (!result.success) {
          throw new Error(`${method} ${url}: response does not match the schema\n${z.prettifyError(result.error)}`);
        }
        body = result.data;
      }
      return { status, headers: response.headers(), body: body as T, ms };
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
