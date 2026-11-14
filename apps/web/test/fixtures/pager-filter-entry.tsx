// Isolated actual-component browser fixture; never imported by product routes.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CustomerPagination } from "../../features/customers/CustomerPagination.tsx";
import { RetailPagination } from "../../features/retail-packages/RetailPagination.tsx";
import { CarrierConnectionPagination } from "../../features/carrier-connections/CarrierConnectionList.tsx";
import { SyncHistoryPanel } from "../../features/carrier-connections/CarrierSyncPanels.tsx";
import { RetailFilterPopover } from "../../features/retail-packages/RetailFilterPopover.tsx";
import { CarrierFilterPopover } from "../../features/carrier-connections/CarrierFilterPopover.tsx";
import { SYNC_FIXTURE, PARITY_PROVIDERS } from "./carrier-connections.ts";
import { makeFilter } from "../../features/retail-packages/filters.ts";
import type { FilterCondition } from "../../features/retail-packages/types.ts";
import type { CarrierFilterCondition } from "../../features/carrier-connections/types.ts";
import "../../styles/globals.css";
const params = new URLSearchParams(location.search);
const unknown = params.has("unknown"),
  empty = params.has("empty");
function Fixture() {
  const [customer, setCustomer] = useState({
    page: empty || params.has("single") ? 1 : 2,
    pageSize: 10,
  });
  const [retail, setRetail] = useState({
    page: empty || params.has("single") ? 1 : 2,
    pageSize: 10,
  });
  const [carrier, setCarrier] = useState({
    page: empty || params.has("single") ? 1 : 2,
    pageSize: 10,
  });
  const [history, setHistory] = useState({
    page: 2,
    type: "all",
    state: "all",
    range: "",
    appliedRange: "",
  });
  const [filters, setFilters] = useState<FilterCondition[]>(
    params.has("max")
      ? Array.from({ length: 12 }, (_, i) => ({
          ...makeFilter("trackingCode", "contains", String(i))!,
          id: `seed-${i}`,
        }))
      : [],
  );
  const [conditions, setConditions] = useState<CarrierFilterCondition[]>(
    params.has("carrierMax")
      ? Array.from(
          { length: 12 },
          (_, i): CarrierFilterCondition => ({
            id: `seed-${i}`,
            field: "accountName",
            operator: "contains",
            value: String(i),
          }),
        )
      : [],
  );
  const total = empty ? 0 : params.has("single") ? 3 : 73;
  const historyTotal = Number(params.get("historyTotal") ?? 24);
  const data = {
    ...SYNC_FIXTURE,
    history: [],
    serverHistory: {
      total: historyTotal,
      types: [],
      summary: {
        total: historyTotal,
        completed: historyTotal,
        running: 0,
        failed: 0,
      },
    },
  };
  return (
    <main>
      <section data-pager-filter-case="customer">
        <h2>Customer</h2>
        <CustomerPagination
          query={customer}
          pagination={
            unknown
              ? undefined
              : {
                  ...customer,
                  total,
                  totalPages: Math.ceil(total / customer.pageSize),
                }
          }
          rowCount={unknown ? 0 : 10}
          stats={unknown ? { total, active: total, inactive: 0 } : undefined}
          loading={false}
          onQuery={(q) => setCustomer((v) => ({ ...v, ...q }))}
        />
      </section>
      <section data-pager-filter-case="retail">
        <h2>Retail</h2>
        <RetailPagination
          {...retail}
          total={total}
          unavailable={unknown}
          onPage={(page) => setRetail((v) => ({ ...v, page }))}
          onSize={(pageSize) => setRetail({ page: 1, pageSize })}
        />
      </section>
      <section data-pager-filter-case="carrier">
        <h2>Carrier account</h2>
        <CarrierConnectionPagination
          model={{
            ...carrier,
            total,
            totalPages: Math.max(1, Math.ceil(total / carrier.pageSize)),
            rows: [],
            start: 11,
            end: 20,
          }}
          known={!unknown}
          onChange={(q) => setCarrier((v) => ({ ...v, ...q }))}
        />
      </section>
      <section data-pager-filter-case="history">
        <SyncHistoryPanel
          data={unknown ? undefined : data}
          query={history}
          onChange={(q) => setHistory((v) => ({ ...v, ...q }))}
          onInspect={() => {}}
        />
      </section>
      <section
        data-pager-filter-case="retail-filter"
        style={{ position: "relative", minHeight: 440 }}
      >
        <h2>Retail filter</h2>
        <button data-outside="retail-filter">Outside retail</button>
        <RetailFilterPopover
          filters={filters}
          onAdd={(f) => {
            setFilters((v) => [...v, f]);
            return true;
          }}
        />
        <output>{filters.length}</output>
      </section>
      <section
        data-pager-filter-case="carrier-filter"
        style={{ position: "relative", minHeight: 440 }}
      >
        <h2>Carrier filter</h2>
        <button data-outside="carrier-filter">Outside carrier</button>
        <CarrierFilterPopover
          conditions={conditions}
          providers={PARITY_PROVIDERS}
          allowEnvironment={params.has("environment")}
          onAdd={(f) => {
            if (conditions.length >= 12) return false;
            setConditions((v) => [...v, f]);
            return true;
          }}
        />
        <output>{conditions.length}</output>
      </section>
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
