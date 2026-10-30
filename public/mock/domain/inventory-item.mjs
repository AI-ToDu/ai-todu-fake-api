import { Sku, Quantity, Money, DomainError } from '../value-objects.mjs';
export class InventoryItem {
  constructor(resource) {
    this.id = resource.id;
    this.sku = new Sku(resource.sku);
    this.quantity = new Quantity(resource.quantity);
    this.price = new Money(resource.price);
    this.cost = new Money(resource.cost);
    this.conservation = resource.conservation;
  }
  receive(amount) {
    this.quantity = new Quantity(
      this.quantity.value + new Quantity(amount, { positive: true }).value,
    );
  }
  issue(amount) {
    const quantity = new Quantity(amount, { positive: true });
    if (quantity.value > this.quantity.value) throw new DomainError('INSUFFICIENT_STOCK', 409);
    this.quantity = new Quantity(this.quantity.value - quantity.value);
  }
  ensureSellable(amount) {
    if (this.conservation !== 'GOOD') throw new DomainError('PRODUCT_BLOCKED', 409);
    if (new Quantity(amount, { positive: true }).value > this.quantity.value)
      throw new DomainError('INSUFFICIENT_STOCK', 409);
  }
}
