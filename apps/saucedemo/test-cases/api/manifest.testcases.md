# Test cases — App manifest API

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | Framework example: API test layer (no requirement MD) |
| Jira        | —                                       |
| Epic        | Platform                                |
| Feature     | App manifest API                        |
| Platform    | api                                     |
| Spec file   | tests/api/manifest/manifest.spec.ts     |

## Preconditions
- None: public endpoint, no login.

## Test cases
| ID          | Title                                     | Type     | Priority | Tags                 | Steps                          | Expected result                                                  | Automate |
| ----------- | ----------------------------------------- | -------- | -------- | -------------------- | ------------------------------ | ---------------------------------------------------------------- | -------- |
| TC-API-01   | Manifest matches its contract             | api      | normal   | @smoke @api          | 1. GET /manifest.json          | 200 within 3 s; body matches ManifestSchema; name "Swag Labs"    | yes      |
| TC-API-02   | Manifest has every install icon size      | api      | minor    | @regression @api     | 1. GET /manifest.json          | Icons 192x192, 256x256, 384x384 and 512x512                      | yes      |
| TC-API-03   | Unknown file returns 404                  | api      | minor    | @regression @api     | 1. GET /does-not-exist.json    | Status 404                                                       | yes      |

<!-- Type: positive, negative, boundary, ui, security, api, accessibility, visual, performance. Automate: yes / no (manual only) / later -->

## Change history
