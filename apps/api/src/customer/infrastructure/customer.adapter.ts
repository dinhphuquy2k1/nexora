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
  assertAddressDeletion,
  CustomerStatus,
  type CustomerQuery,
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
      Array<{ id: string; name: string; phone: string }>
    >`SELECT id,name,phone_normalized AS phone FROM customers WHERE id=${id}::uuid AND owner_user_id=${owner}::uuid FOR UPDATE`;
    if (!rows.length) throw new CustomerError("NOT_FOUND");
    return rows[0];
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
    return { ...row, status: row.status as CustomerStatus };
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
          status: row.status as CustomerStatus,
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
      const row = await tx.customer.create({
        data: {
          ...input,
          ownerUserId: owner,
          createdByUserId: owner,
          status: CustomerStatus.ACTIVE,
        },
        select: { id: true },
      });
      await tx.customerAddress.create({
        data: {
          ...address,
          recipientName: address.recipientName ?? input.name,
          recipientPhone: address.recipientPhone ?? input.phone,
          customerId: row.id,
          isDefault: true,
        },
        select: { id: true },
      });
      return this.detail(tx, owner, row.id);
    });
  }
  get(owner: string, id: string) {
    return this.transaction(owner, (tx) => this.detail(tx, owner, id));
  }
  update(owner: string, id: string, input: CustomerPatch) {
    return this.transaction(owner, async (tx) => {
      await this.lockCustomer(tx, owner, id);
      const result = await tx.customer.updateMany({
        where: { id, ownerUserId: owner },
        data: input,
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
      return this.detail(tx, owner, id);
    });
  }
  addAddress(owner: string, id: string, input: AddressCreate) {
    return this.transaction(owner, async (tx) => {
      const parent = await this.lockCustomer(tx, owner, id);
      const existingDefault = await tx.customerAddress.findFirst({
        where: { ...this.addressWhere(owner, id), isDefault: true },
        select: { id: true },
      });
      const row = await tx.customerAddress.create({
        data: {
          ...input,
          recipientName: input.recipientName ?? parent.name,
          recipientPhone: input.recipientPhone ?? parent.phone,
          customerId: id,
          isDefault: !existingDefault,
        },
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
      await this.lockCustomer(tx, owner, id);
      const result = await tx.customerAddress.updateMany({
        where: this.addressWhere(owner, id, addressId),
        data: input,
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
      return this.address(tx, owner, id, addressId);
    });
  }
  async removeAddress(owner: string, id: string, addressId: string) {
    await this.transaction(owner, async (tx) => {
      await this.lockCustomer(tx, owner, id);
      const address = await this.address(tx, owner, id, addressId);
      const count = await tx.customerAddress.count({
        where: this.addressWhere(owner, id),
      });
      assertAddressDeletion(count, address.isDefault);
      const result = await tx.customerAddress.deleteMany({
        where: this.addressWhere(owner, id, addressId),
      });
      if (result.count !== 1) throw new CustomerError("NOT_FOUND");
    });
  }
  setDefault(owner: string, id: string, addressId: string) {
    return this.transaction(owner, async (tx) => {
      await this.lockCustomer(tx, owner, id);
      const selected = await this.address(tx, owner, id, addressId);
      if (selected.isDefault) return selected;
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
