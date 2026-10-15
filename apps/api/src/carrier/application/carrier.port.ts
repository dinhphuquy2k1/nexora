import type { ConnectionMetadata } from "../domain/carrier";
export abstract class CarrierPort {
  abstract list(userId: string): Promise<ConnectionMetadata[]>;
  abstract rename(
    userId: string,
    id: string,
    displayName: string,
  ): Promise<ConnectionMetadata>;
  abstract remove(userId: string, id: string): Promise<void>;
}
