# Test cases — Products

| Item        | Value                                   |
| ----------- | --------------------------------------- |
| Source      | requirements/web/SCRUM-102-products.md  |
| Jira        | SCRUM-102                               |
| Epic        | Shopping                                |
| Feature     | Products                                |
| Platform    | web, mobile-web                         |
| Spec file   | tests/web/inventory/products.spec.ts    |

## Preconditions
- User is logged in (saved session from tests/web/auth.setup.ts) and on /inventory.html.

## Test cases
| ID         | Title                                       | Type     | Priority | Tags         | Steps                                           | Expected result                     | Automate |
| ---------- | ------------------------------------------- | -------- | -------- | ------------ | ----------------------------------------------- | ----------------------------------- | -------- |
| TC-PROD-01 | All products are listed                     | positive | critical | @smoke       | 1. Open Products page                           | Title "Products", 6 product cards   | yes      |
| TC-PROD-02 | Adding products updates the cart badge      | positive | critical | @regression  | 1. Add Backpack 2. Add Bike Light               | Badge shows 1, then 2               | yes      |
| TC-PROD-03 | Removing a product updates the cart badge   | positive | normal   | @regression  | 1. Add Bolt T-Shirt 2. Click Remove             | Badge is hidden                     | yes      |
| TC-PROD-04 | Sort by price low to high                   | positive | normal   | @regression  | 1. Choose "Price (low to high)"                 | Prices are in ascending order       | yes      |
| TC-PROD-05 | Sort by name Z to A                         | positive | minor    | @regression  | 1. Choose "Name (Z to A)"                       | Names are in descending order       | yes      |
| TC-PROD-06 | Products page meets WCAG 2.1 AA             | accessibility | normal | @regression @a11y | 1. Open Products page 2. Run accessibility scan | No serious or critical WCAG 2.1 AA violations | yes |
| TC-PROD-07 | Products page looks as approved             | visual   | minor    | @regression @visual | 1. Open Products page 2. Compare with approved screenshot | Page matches the approved screenshot (max 1% pixels differ) | yes |
| TC-PROD-08 | Products page loads within budget           | performance | normal | @regression @perf | 1. Open Products page 2. Measure page load | First contentful paint under 2.5 s, page load under 4 s, under 2 MB transferred | yes |
