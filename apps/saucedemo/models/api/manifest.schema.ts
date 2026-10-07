/**
 * Web app manifest (GET /manifest.json): response contract.
 * Test cases: test-cases/api/manifest.testcases.md
 *
 * API models are zod schemas: `api.get(url, { schema })` checks the response against them and returns it typed.
 */
import { z } from 'zod';

export const ManifestIconSchema = z.object({
  src: z.string().startsWith('/'),
  sizes: z.string().regex(/^\d+x\d+$/),
  type: z.literal('image/png'),
});

export const ManifestSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().min(1),
  start_url: z.string(),
  display: z.enum(['fullscreen', 'standalone', 'minimal-ui', 'browser']),
  theme_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  background_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  icons: z.array(ManifestIconSchema).min(1),
});

export type Manifest = z.infer<typeof ManifestSchema>;
