import { Injectable, HttpException } from "@nestjs/common";
import { CarrierPort } from "./carrier.port";
import { CarrierProvider, CarrierError } from "../domain/carrier";
@Injectable()
export class CarrierService {
  constructor(private readonly port: CarrierPort) {}
  providers() {
    return {
      carriers: [{ provider: CarrierProvider.UNISHIP, displayName: "Uniship" }],
    };
  }
  private validateId(id: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id,
      )
    )
      this.invalid();
  }
  private invalid(): never {
    throw new HttpException(
      { code: "VALIDATION_ERROR", message: "Yêu cầu không hợp lệ" },
      400,
    );
  }
  private async mapped<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof CarrierError)) throw e;
      const status = e.code === "NOT_FOUND" ? 404 : 401;
      throw new HttpException(
        { code: e.code, message: "Không thể thực hiện yêu cầu" },
        status,
      );
    }
  }
  async list(userId: string) {
    return { connections: await this.mapped(() => this.port.list(userId)) };
  }
  async rename(userId: string, id: string, input: unknown) {
    this.validateId(id);
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !Object.hasOwn(input, "displayName")
    )
      this.invalid();
    const name = (input as { displayName?: unknown }).displayName;
    if (typeof name !== "string" || name.trim().length < 1 || name.length > 100)
      this.invalid();
    return {
      connection: await this.mapped(() =>
        this.port.rename(userId, id, name.trim()),
      ),
    };
  }
  async remove(userId: string, id: string) {
    this.validateId(id);
    await this.mapped(() => this.port.remove(userId, id));
    return { success: true };
  }
}
