import { changeCustomerProfile } from "../domain/customer-profile.policy";
import { CustomerAggregate } from "../domain/customer.aggregate";
import { hydrateCustomer } from "./customer.mapper";
import type { CustomerQuery } from "../application/customer.input";
import { isOwnerPhoneConflict } from "./customer-db-error";
import {
  createDatabase,
  type PrismaClient,
  type Prisma,
} from "@nexora/database";
import { UserStatus } from "../../identity/domain/user-policy";
import { CustomerPort } from "../application/customer.port";
import {
  CustomerError,
  type CustomerStatusCode,
  type CustomerFields,
  type CustomerPatch,
  type AddressCreate,
  type AddressFields,
  type CustomerAddress,
  type CustomerDetail,
} from "../domain/customer";
const summary = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  note: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
const addressFields = {
  id: true,
  label: true,
  recipientName: true,
  recipientPhone: true,
  countryCode: true,
  addressText: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;
export class CustomerAdapter implements CustomerPort {
  private instance?: PrismaClient;
  constructor(private readonly url: string) {}
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  private async transaction<T>(
    owner: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ status: string }>
        >`SELECT status FROM users WHERE id=${owner}::uuid FOR UPDATE`;
        if (rows[0]?.status !== UserStatus.ACTIVE)
          throw new CustomerError("UNAUTHORIZED");
        return fn(tx);
      });
    } catch (error) {
      if (error instanceof CustomerError) throw error;
      // Only this specific owner-phone constraint is a domain duplicate; all other DB faults stay generic500.
      if (isOwnerPhoneConflict(error))
        throw new CustomerError("CUSTOMER_PHONE_EXISTS");
      throw error;
    }
  }
  private async lockCustomer(
    tx: Prisma.TransactionClient,
    owner: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM customers WHERE id=${id}::uuid AND owner_user_id=${owner}::uuid FOR UPDATE`;
    if (!rows.length) throw new CustomerError("NOT_FOUND");
  }
  private async detail(
    tx: Prisma.TransactionClient,
    owner: string,
    id: string,
  ): Promise<CustomerDetail> {
    const row = await tx.customer.findFirst({
      where: { id, ownerUserId: owner },
      select: {
        ...summary,
        addresses: {
          select: addressFields,
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!row) throw new CustomerError("NOT_FOUND");
    return { ...row, status: row.status as CustomerStatusCode };
  }
  private addressWhere(owner: string, id: string, addressId?: string) {
    return {
      customerId: id,
      customer: { ownerUserId: owner },
      ...(addressId ? { id: addressId } : {}),
    };
  }
  private async address(
    tx: Prisma.TransactionClient,
    owner: string,
    id: string,
    addressId: string,
  ): Promise<CustomerAddress> {
    const row = await tx.customerAddress.findFirst({
      where: this.addressWhere(owner, id, addressId),
      select: addressFields,
    });
    if (!row) throw new CustomerError("NOT_FOUND");
    return row;
  }
  list(owner: string, query: CustomerQuery) {
    const search = query.q?.replace(/[\\%_]/g, "\\$&");
    return this.transaction(owner, async (tx) => {
      const where: Prisma.CustomerWhereInput = {
        ownerUserId: owner,
        ...(query.status ? { status: query.status } : {}),
        ...(query.phone ? { phone: query.phone } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                ...(query.searchPhone ? [{ phone: query.searchPhone }] : []),
              ],
            }
          : {}),
      };
      // Actor lock serializes all application writes for this owner; count/list share that transaction.
      const total = await tx.customer.count({ where });
      const rows = await tx.customer.findMany({
        where,
        select: summary,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return {
        customers: rows.map((row) => ({
          ...row,
          status: row.status as CustomerStatusCode,
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    });
  }
  create(owner: string, input: CustomerFields, address: AddressCreate) {
    return this.transaction(owner, async (tx) => {
      const draft = CustomerAggregate.create(input, address).creation();
      const row = await tx.customer.create({
        data: {
          ...draft.fields,
          ownerUserId: owner,
          createdByUserId: owner,
          status: draft.status,
        },
        select: { id: true },
      });
      await tx.customerAddress.create({
        data: {
          ...draft.address,
          customerId: row.id,
          isDefault: draft.isDefault,
        },
        select: { id: true },
      });
      return this.detail(tx, owner, row.id);
    });
  }
  get(owner: string, id: string) {
    return this.transaction(owner, (tx) => this.detail(tx, owner, id));
  }
  private async aggregate(
    tx: Prisma.TransactionClient,
    owner: string,
    id: string,
  ) {
    // Actor lock is already held by transaction(); hydrate only after parent lock.
    await this.lockCustomer(tx, owner, id);
    const row = await tx.customer.findFirst({
      where: { id, ownerUserId: owner },
      select: {
        ...summary,
        ownerUserId: true,
        createdByUserId: true,
        addresses: { select: addressFields },
      },
    });
    if (!row) throw new CustomerError("NOT_FOUND");
    return hydrateCustomer(row);
  }
  update(owner: string, id: string, input: CustomerPatch) {
    return this.transaction(owner, async (tx) => {
      await this.lockCustomer(tx, owner, id);
      const row = await tx.customer.findFirst({
        where: { id, ownerUserId: owner },
        select: { status: true },
      });
      if (!row) throw new CustomerError("NOT_FOUND");
      const patch = changeCustomerProfile(row.status, input);
      const result = await tx.customer.updateMany({
        where: { id, ownerUserId: owner },
        data: patch,
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
      return this.detail(tx, owner, id);
    });
  }
  addAddress(owner: string, id: string, input: AddressCreate) {
    return this.transaction(owner, async (tx) => {
      const customer = await this.aggregate(tx, owner, id);
      const insertion = customer.addAddress(input);
      const row = await tx.customerAddress.create({
        data: { ...insertion, customerId: id },
        select: { id: true },
      });
      return this.address(tx, owner, id, row.id);
    });
  }
  updateAddress(
    owner: string,
    id: string,
    addressId: string,
    input: Partial<AddressFields>,
  ) {
    return this.transaction(owner, async (tx) => {
      const customer = await this.aggregate(tx, owner, id);
      const patch = customer.updateAddress(addressId, input);
      const result = await tx.customerAddress.updateMany({
        where: this.addressWhere(owner, id, addressId),
        data: patch,
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
      return this.address(tx, owner, id, addressId);
    });
  }
  async removeAddress(owner: string, id: string, addressId: string) {
    await this.transaction(owner, async (tx) => {
      const customer = await this.aggregate(tx, owner, id);
      customer.removeAddress(addressId);
      const result = await tx.customerAddress.deleteMany({
        where: this.addressWhere(owner, id, addressId),
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
    });
  }
  setDefault(owner: string, id: string, addressId: string) {
    return this.transaction(owner, async (tx) => {
      const customer = await this.aggregate(tx, owner, id);
      if (!customer.setDefaultAddress(addressId))
        return this.address(tx, owner, id, addressId);
      // Technical write ordering preserves the existing partial unique index.
      await tx.customerAddress.updateMany({
        where: { ...this.addressWhere(owner, id), isDefault: true },
        data: { isDefault: false },
      });
      const result = await tx.customerAddress.updateMany({
        where: this.addressWhere(owner, id, addressId),
        data: { isDefault: true },
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
      return this.address(tx, owner, id, addressId);
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
