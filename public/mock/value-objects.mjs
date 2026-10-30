export class DomainError extends Error {
  constructor(code, status = 422) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export const fail = (code, status) => {
  throw new DomainError(code, status);
};
export class Sku {
  constructor(value) {
    this.value = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(this.value)) fail('INVALID_SKU');
    Object.freeze(this);
  }
}
export class Quantity {
  constructor(value, { positive = false } = {}) {
    if (
      value === null ||
      value === undefined ||
      typeof value === 'boolean' ||
      String(value).trim() === ''
    )
      fail('INVALID_QUANTITY');
    this.value = Number(value);
    if (
      !Number.isSafeInteger(this.value) ||
      this.value > 1000000 ||
      this.value < 0 ||
      (positive && this.value === 0)
    )
      fail('INVALID_QUANTITY');
    Object.freeze(this);
  }
}
export class Money {
  constructor(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value === 'boolean' ||
      String(value).trim() === ''
    )
      fail('INVALID_MONEY');
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      n > 100000000 ||
      Math.abs(n * 100 - Math.round(n * 100)) > 0.00001
    )
      fail('INVALID_MONEY');
    this.cents = Math.round(n * 100);
    this.currency = 'PEN';
    Object.freeze(this);
  }
  get value() {
    return this.cents / 100;
  }
}
export class Address {
  constructor(value) {
    this.value = String(value ?? '').trim();
    if (this.value.length < 5 || this.value.length > 240) fail('INVALID_ADDRESS');
    Object.freeze(this);
  }
}
