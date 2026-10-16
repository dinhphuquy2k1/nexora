import type { Prisma, PrismaClient } from "@nexora/database";
import { SecurityAuditPort } from "../application/security-audit.port";
import type { CarrierSecurityEvent } from "../domain/security-audit";

/** Only fixed typed columns; no arbitrary payload. append's single INSERT commits before resolving. */
export class PostgresSecurityAudit extends SecurityAuditPort {
  constructor(private readonly db: PrismaClient) {
    super();
  }
  async append(event: CarrierSecurityEvent): Promise<void> {
    await PostgresSecurityAudit.insert(this.db, event);
  }
  static async insert(
    db: Pick<Prisma.TransactionClient, "securityAuditEvent">,
    event: CarrierSecurityEvent,
  ): Promise<void> {
    await db.securityAuditEvent.create({ data: event });
  }
}
