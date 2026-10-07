import type { APIRequestContext } from '@playwright/test';
import { z, type ZodType } from 'zod';
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
}

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

  private send<T>(method: string, url: string, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
    return step(`API ${method} ${url}`, async () => {
      const started = Date.now();
      const response = await this.request.fetch(url, {
        method,
        data: options.data,
        params: options.params,
        headers: options.headers,
      });
      const text = await response.text();
      const ms = Date.now() - started;
      const status = response.status();
      const ok = options.expectStatus !== undefined ? status === options.expectStatus : response.ok();
      if (!ok) {
        const expected = options.expectStatus ?? '2xx';
        throw new Error(`${method} ${url} returned ${status} (expected ${expected}): ${text.slice(0, 500)}`);
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

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
