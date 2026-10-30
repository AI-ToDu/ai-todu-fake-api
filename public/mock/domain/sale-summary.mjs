import { Money, Quantity, DomainError } from '../value-objects.mjs';
export class SaleSummary {
  constructor(lines) {
    let cents = 0;
    for (const line of lines) {
      const quantity = new Quantity(line.quantity, { positive: true });
      const price = new Money(line.product.price);
      const subtotal = price.cents * quantity.value;
      if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(cents + subtotal))
        throw new DomainError('INVALID_MONEY');
      cents += subtotal;
    }
    this.total = new Money(cents / 100);
    Object.freeze(this);
  }
}
