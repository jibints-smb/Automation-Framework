/**
 * Products (inventory) page — field model.
 * Source: requirements/web/SCRUM-102-products.md
 */
import { defineWebFields, type WebField } from '@core/models/field.types';

export const SortOptions = {
  nameAsc: 'Name (A to Z)',
  nameDesc: 'Name (Z to A)',
  priceAsc: 'Price (low to high)',
  priceDesc: 'Price (high to low)',
} as const;

export type SortOption = (typeof SortOptions)[keyof typeof SortOptions];

export const InventoryFields = defineWebFields({
  pageTitle: { label: 'Page title', type: 'label', locator: { testId: 'title' } },
  productCards: { label: 'Product card', type: 'label', locator: { testId: 'inventory-item' } },
  productNames: { label: 'Product name', type: 'label', locator: { testId: 'inventory-item-name' } },
  productPrices: { label: 'Product price', type: 'label', locator: { testId: 'inventory-item-price' } },
  sortDropdown: {
    label: 'Sort dropdown',
    type: 'dropdown',
    locator: { testId: 'product-sort-container' },
    rules: { options: Object.values(SortOptions) },
  },
  cartBadge: { label: 'Cart badge', type: 'label', locator: { testId: 'shopping-cart-badge' } },
  cartLink: { label: 'Cart', type: 'link', locator: { testId: 'shopping-cart-link' } },
});

/** Fields whose locator depends on data (one per product). */
export const InventoryDynamicFields = {
  addToCartButton: (product: string): WebField => ({
    label: `Add to cart: ${product}`,
    type: 'button',
    locator: { testId: `add-to-cart-${slug(product)}` },
  }),
  removeButton: (product: string): WebField => ({
    label: `Remove: ${product}`,
    type: 'button',
    locator: { testId: `remove-${slug(product)}` },
  }),
};

function slug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}
