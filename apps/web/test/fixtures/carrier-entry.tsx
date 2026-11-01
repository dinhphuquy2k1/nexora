// Isolated visual test entry; never a production route or authentication bypass.
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@nexora/ui";
import { CarrierConnectionsPage } from "../../features/carrier-connections/CarrierConnectionsPage.tsx";
import { CARRIER_FIXTURES, SYNC_FIXTURE } from "./carrier-connections.ts";
import "../../app/styles.css";
const empty = new URLSearchParams(location.search).has("empty");
createRoot(document.getElementById("fixture-root")!).render(
  <ToastProvider>
    <p>Dữ liệu kiểm thử tổng hợp — không kết nối hãng, không lưu.</p>
    <CarrierConnectionsPage
      records={empty ? [] : CARRIER_FIXTURES}
      syncByConnection={Object.fromEntries(
        CARRIER_FIXTURES.map((row) => [row.id, SYNC_FIXTURE]),
      )}
    />
  </ToastProvider>,
);
