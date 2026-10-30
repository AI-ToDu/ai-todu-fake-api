import { Address, DomainError } from '../value-objects.mjs';
export class DispatchManifest {
  constructor(resource) {
    this.id = resource.id;
    this.destination = new Address(resource.destination);
    this.status = resource.status;
  }
  transition(next) {
    const allowed = { PENDING: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' }[this.status];
    if (!allowed || next !== allowed) throw new DomainError('INVALID_TRANSITION', 409);
    this.status = next;
  }
}
