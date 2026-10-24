import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createNexoraClient } from "../../../packages/sdk/src/index.ts";
import { createCustomerApi } from "../features/customers/api.ts";

test("all eight generated SDK operations retain exact path/method/body and old stats stays unavailable", async () => {
  const requests = [];
  const now = new Date().toISOString();
  const address = {
    id: "a",
    label: null,
    recipientName: "Test",
    recipientPhone: "+84912345678",
    countryCode: "VN",
    addressText: "Synthetic owned fixture",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  const c = {
    id: "c",
    code: "KH000001",
    name: "Test",
    phone: "+84912345678",
    email: null,
    note: null,
    status: "ACTIVE",
    statusLabel: "Đang hoạt động",
    createdAt: now,
    updatedAt: now,
    addresses: [address],
  };
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const b of req) raw += b;
    requests.push({
      method: req.method,
      url: req.url,
      body: raw ? JSON.parse(raw) : undefined,
    });
    let data = { address };
    if (req.url.startsWith("/api/customers?"))
      data = {
        customers: [c],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
    else if (req.method === "DELETE") data = { success: true };
    else if (req.url === "/api/customers" || req.url === "/api/customers/c")
      data = { customer: c };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(data));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const api = createCustomerApi(
      createNexoraClient(`http://127.0.0.1:${server.address().port}`),
    );
    const list = await api.list({ page: 1, pageSize: 20 });
    assert.equal(list.stats, null);
    await api.create({
      name: "Test",
      phone: "123",
      address: { countryCode: "VN", addressText: "A" },
    });
    await api.get("c");
    await api.update("c", { email: null });
    await api.add("c", { countryCode: "VN", addressText: "B" });
    await api.patchAddress("c", "a", { countryCode: "VN", label: null });
    await api.remove("c", "a");
    await api.setDefault("c", "a");
    assert.deepEqual(
      requests.map((r) => [r.method, r.url]),
      [
        ["GET", "/api/customers?page=1&pageSize=20"],
        ["POST", "/api/customers"],
        ["GET", "/api/customers/c"],
        ["PATCH", "/api/customers/c"],
        ["POST", "/api/customers/c/addresses"],
        ["PATCH", "/api/customers/c/addresses/a"],
        ["DELETE", "/api/customers/c/addresses/a"],
        ["PUT", "/api/customers/c/default-address"],
      ],
    );
    assert.deepEqual(requests[7].body, { addressId: "a" });
    assert.deepEqual(requests[3].body, { email: null });
    assert.deepEqual(requests[5].body, { countryCode: "VN", label: null });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
