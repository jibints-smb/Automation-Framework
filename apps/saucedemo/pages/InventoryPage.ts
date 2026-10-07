import { BasePage } from '@core/web/BasePage';
import { InventoryDynamicFields, InventoryFields, type SortOption } from '@apps/saucedemo/models/web/inventory.model';

export class InventoryPage extends BasePage {
  readonly path = '/inventory.html';
  readonly fields = InventoryFields;

  async expectLoaded(): Promise<void> {
    await this.verify.url(/inventory\.html/);
    await this.verify.text(this.fields.pageTitle, 'Products');
  }

  async addToCart(product: string): Promise<void> {
    await this.act.click(InventoryDynamicFields.addToCartButton(product));
  }

  async removeFromCart(product: string): Promise<void> {
    await this.act.click(InventoryDynamicFields.removeButton(product));
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.act.select(this.fields.sortDropdown, option);
  }

  async getProductNames(): Promise<string[]> {
    return this.act.getAllTexts(this.fields.productNames);
  }

  async getProductPrices(): Promise<number[]> {
    const texts = await this.act.getAllTexts(this.fields.productPrices);
    return texts.map((t) => Number(t.replace(/[^0-9.]/g, '')));
  }

  async expectCartCount(count: number): Promise<void> {
    if (count === 0) await this.verify.hidden(this.fields.cartBadge);
    else await this.verify.text(this.fields.cartBadge, String(count));
  }
}
