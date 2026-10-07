/**
 * Story:      SCRUM-102 — User can browse and add products   (requirements/web/SCRUM-102-products.md)
 * Test cases: test-cases/web/products.testcases.md
 */
import { expect, test } from '@apps/saucedemo/fixtures';
import { products, TOTAL_PRODUCTS } from '@apps/saucedemo/data/web/inventory.data';
import { SortOptions } from '@apps/saucedemo/models/web/inventory.model';
import { storyInfo } from '@core/utils/allure';

test.describe('Products', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await storyInfo({
      epic: 'Shopping',
      feature: 'Products',
      story: 'SCRUM-102 User can browse and add products',
      jira: 'SCRUM-102',
      severity: 'normal',
    });
    await inventoryPage.open();
  });

  test('TC-PROD-01 | All products are listed', { tag: ['@smoke', '@TC-PROD-01'] }, async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await inventoryPage.verify.count(inventoryPage.fields.productCards, TOTAL_PRODUCTS);
  });

  test('TC-PROD-02 | Adding products updates the cart badge', { tag: ['@regression', '@TC-PROD-02'] }, async ({ inventoryPage }) => {
    await inventoryPage.addToCart(products.backpack);
    await inventoryPage.expectCartCount(1);

    await inventoryPage.addToCart(products.bikeLight);
    await inventoryPage.expectCartCount(2);
  });

  test('TC-PROD-03 | Removing a product updates the cart badge', { tag: ['@regression', '@TC-PROD-03'] }, async ({ inventoryPage }) => {
    await inventoryPage.addToCart(products.boltTShirt);
    await inventoryPage.removeFromCart(products.boltTShirt);
    await inventoryPage.expectCartCount(0);
  });

  test('TC-PROD-04 | Sort by price low to high', { tag: ['@regression', '@TC-PROD-04'] }, async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SortOptions.priceAsc);
    const prices = await inventoryPage.getProductPrices();
    expect(prices).toHaveLength(TOTAL_PRODUCTS);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('TC-PROD-05 | Sort by name Z to A', { tag: ['@regression', '@TC-PROD-05'] }, async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SortOptions.nameDesc);
    const names = await inventoryPage.getProductNames();
    expect(names).toHaveLength(TOTAL_PRODUCTS);
    expect(names).toEqual([...names].sort().reverse());
  });

  test('TC-PROD-06 | Products page meets WCAG 2.1 AA', { tag: ['@regression', '@a11y', '@TC-PROD-06'] }, async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await inventoryPage.verify.accessible();
  });

  test('TC-PROD-07 | Products page looks as approved', { tag: ['@regression', '@visual', '@TC-PROD-07'] }, async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await inventoryPage.verify.looksLike('products-page');
  });

  test('TC-PROD-08 | Products page loads within budget', { tag: ['@regression', '@perf', '@TC-PROD-08'] }, async ({ inventoryPage }) => {
    await inventoryPage.expectLoaded();
    await inventoryPage.verify.performance();
  });
});
