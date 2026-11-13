/** Current single-account owner policy, centralized for every Shipment query. */
export const resolveShipmentOwner = (actor: { id: string }): string => actor.id;
