import type { Prisma, PrismaClient } from "@nexora/database";
import { SecurityAuditPort } from "../application/security-audit.port";
import type { CarrierSecurityEvent } from "../domain/security-audit";

/** Only fixed typed columns; no arbitrary payload. append's single INSERT commits before resolving. */
export class PostgresSecurityAudit extends SecurityAuditPort {
  constructor(
    private readonly db: PrismaClient,
    private readonly bounded = false,
  ) {
    super();
  }
  async append(event: CarrierSecurityEvent): Promise<void> {
    if (!this.bounded) {
      await PostgresSecurityAudit.insert(this.db, event);
      return;
    }
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout='250ms'`;
        await tx.$executeRaw`SET LOCAL statement_timeout='1000ms'`;
        await PostgresSecurityAudit.insert(tx, event);
      },
      { timeout: 2000 },
    );
  }
  static async insert(
    db: Pick<Prisma.TransactionClient, "securityAuditEvent">,
    event: CarrierSecurityEvent,
  ): Promise<void> {
    await db.securityAuditEvent.create({ data: event, select: { id: true } });
  }
}
