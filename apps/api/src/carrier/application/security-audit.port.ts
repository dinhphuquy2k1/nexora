import type { CarrierSecurityEvent } from "../domain/security-audit";
/** append resolves only when a durable write has committed. No noop binding. */
export abstract class SecurityAuditPort {
  abstract append(event: CarrierSecurityEvent): Promise<void>;
}
