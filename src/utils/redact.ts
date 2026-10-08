/**
 * Masks secrets (passwords, tokens from the .env files, Bearer tokens, JWTs, token-like URL query values) in
 * text that goes into the report. step(), errors, logs, API calls and emails use it; see src/report/redact.cjs.
 */
import { secretsFrom, redactText } from '@core/report/redact.cjs';
import { allSettings } from '@core/config/env';

let secrets: string[] | undefined;

export function redact(text: string): string {
  secrets ??= secretsFrom(allSettings());
  return redactText(text, secrets);
}
