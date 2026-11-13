import { Injectable } from "@nestjs/common";
import { ShipmentReadPort } from "./shipment-read.port";
import { resolveShipmentOwner } from "./shipment-owner";
import { shipmentId, shipmentQuery } from "./shipment.input";
import { ShipmentError } from "../domain/shipment";
import { mapShipmentError } from "./shipment-error";
@Injectable()
export class ShipmentService {
  constructor(private readonly port: ShipmentReadPort) {}
  private async run<T>(
    actor: { id: string },
    action: (owner: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await action(resolveShipmentOwner(actor));
    } catch (e) {
      if (e instanceof ShipmentError) throw mapShipmentError(e);
      throw e;
    }
  }
  list(actor: { id: string }, query: unknown) {
    return this.run(actor, (owner) =>
      this.port.list(owner, shipmentQuery(query)),
    );
  }
  get(actor: { id: string }, id: string) {
    return this.run(actor, async (owner) => ({
      shipment: await this.port.get(owner, shipmentId(id)),
    }));
  }
  history(actor: { id: string }, id: string, query: unknown) {
    return this.run(actor, (owner) =>
      this.port.history(owner, shipmentId(id), shipmentQuery(query, true)),
    );
  }
}
