// Test-only derived observations. Never rewrite or re-label owner-captured JSON.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const captured = readFileSync(
  resolve(__dirname, "../fixtures/uniship/transition-page.json"),
  "utf8",
);
const stores = readFileSync(
  resolve(__dirname, "../fixtures/uniship/china-stores.json"),
  "utf8",
);
const row = (extra = {}) => ({
  ...JSON.parse(captured).data[0],
  ID: 100001,
  TransactionCode: "synthetic-uniship",
  ...extra,
});
const page = (data, { total = data.length, offset = 0, size = 100 } = {}) =>
  JSON.stringify({
    status: 200,
    message: "Success",
    data,
    total,
    offset,
    rowsPerPage: size,
    summary: {
      TotalStatusAll: total,
      TotalStatus0: 0,
      TotalStatus1: total,
      TotalStatus2: 0,
      TotalStatus3: 0,
      TotalStatus4: 0,
      TotalStatus5: 0,
      TotalStatus13: 0,
    },
  });
const job = (extra = {}) => ({
  provider: "uniship",
  sync_type: "SHIPMENT",
  fetch_strategy: "FULL",
  next_page: 1,
  next_cursor: null,
  target_watermark: null,
  carrier_connection_id: "connection",
  owner_user_id: "owner",
  external_account_id: "account",
  generation: 0,
  lifecycle_version: 0,
  ...extra,
});
module.exports = { captured, stores, row, page, job };
