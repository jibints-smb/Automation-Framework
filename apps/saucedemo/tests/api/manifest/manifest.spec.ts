/**
 * App manifest API: example of the API test layer (no browser).
 * Test cases: test-cases/api/manifest.testcases.md · Contract: models/api/manifest.schema.ts
 */
import { expect, test } from '@apps/saucedemo/fixtures';
import { ManifestSchema } from '@apps/saucedemo/models/api/manifest.schema';
import { storyInfo } from '@core/utils/allure';

test.describe('App manifest API', () => {
  test.beforeEach(async () => {
    await storyInfo({ epic: 'Platform', feature: 'App manifest API', story: 'Manifest is served for installing the app' });
  });

  test('TC-API-01 | Manifest matches its contract', { tag: ['@smoke', '@api', '@TC-API-01'] }, async ({ api }) => {
    const { body } = await api.get('/manifest.json', { schema: ManifestSchema, maxMs: 3000 });
    expect(body.name).toBe('Swag Labs');
  });

  test('TC-API-02 | Manifest has every install icon size', { tag: ['@regression', '@api', '@TC-API-02'] }, async ({ api }) => {
    const { body } = await api.get('/manifest.json', { schema: ManifestSchema });
    expect(body.icons.map((icon) => icon.sizes)).toEqual(['192x192', '256x256', '384x384', '512x512']);
  });

  test('TC-API-03 | Unknown file returns 404', { tag: ['@regression', '@api', '@TC-API-03'] }, async ({ api }) => {
    await api.get('/does-not-exist.json', { expectStatus: 404 });
  });
});
