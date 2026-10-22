/** SessionGuard supplies this actor. Request ownership/role fields never enter resolution. */
export function resolveCustomerOwner(actor: { id: string }): string {
  return actor.id;
}
