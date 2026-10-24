import { createNexoraClient } from "@nexora/sdk";
import type {
  Query,
  Create,
  Patch,
  AddressCreate,
  AddressPatch,
} from "./types.ts";
import { CustomerApiError } from "./errors.ts";
import { readCustomerPage, readCustomer, isAddress } from "./response.ts";
export function createCustomerApi(client = createNexoraClient()) {
  const result = (r: {
    response: Response;
    data?: unknown;
    error?: unknown;
  }) => {
    if (!r.response.ok) throw new CustomerApiError(r.response.status, r.error);
    return r.data;
  };
  const address = (r: {
    response: Response;
    data?: unknown;
    error?: unknown;
  }) => {
    const d = result(r) as { address?: unknown } | undefined;
    if (!d || !isAddress(d.address)) throw Error("MALFORMED_RESPONSE");
    return d.address;
  };
  return {
    list: async (query: Query, signal?: AbortSignal) =>
      readCustomerPage(
        result(
          await client.GET("/api/customers", { params: { query }, signal }),
        ),
      ),
    get: async (id: string, signal?: AbortSignal) =>
      readCustomer(
        result(
          await client.GET("/api/customers/{id}", {
            params: { path: { id } },
            signal,
          }),
        ),
      ),
    create: async (body: Create) =>
      readCustomer(result(await client.POST("/api/customers", { body }))),
    update: async (id: string, body: Patch) =>
      readCustomer(
        result(
          await client.PATCH("/api/customers/{id}", {
            params: { path: { id } },
            body,
          }),
        ),
      ),
    add: async (id: string, body: AddressCreate) =>
      address(
        await client.POST("/api/customers/{id}/addresses", {
          params: { path: { id } },
          body,
        }),
      ),
    patchAddress: async (id: string, addressId: string, body: AddressPatch) =>
      address(
        await client.PATCH("/api/customers/{id}/addresses/{addressId}", {
          params: { path: { id, addressId } },
          body,
        }),
      ),
    remove: async (id: string, addressId: string) => {
      const d = result(
        await client.DELETE("/api/customers/{id}/addresses/{addressId}", {
          params: { path: { id, addressId } },
        }),
      ) as { success?: unknown } | undefined;
      if (d?.success !== true) throw Error("MALFORMED_RESPONSE");
    },
    setDefault: async (id: string, addressId: string) =>
      address(
        await client.PUT("/api/customers/{id}/default-address", {
          params: { path: { id } },
          body: { addressId },
        }),
      ),
  };
}
export const customerApi = createCustomerApi();
