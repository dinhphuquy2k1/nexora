"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Button,
  TabBar,
  TabCountBadge,
  buttonClassName,
  type TabBarItem,
} from "@nexora/ui";
import {
  Truck,
  Plus,
  RefreshCw,
  Layers,
  CircleCheck,
  AlertCircle,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import type {
  CarrierConnectionRow,
  CarrierQuery,
  SyncPresentation,
} from "./types.ts";
import {
  CONNECTION_STATES,
  INITIAL_QUERY,
  selectConnections,
  UNAVAILABLE,
} from "./presentation.ts";
import {
  CarrierConnectionToolbar,
  CarrierConnectionTable,
  CarrierConnectionPagination,
  type RowAction,
} from "./CarrierConnectionList.tsx";
import {
  CarrierConnectionDrawer,
  CarrierConnectionDetails,
  CarrierConfirmDialog,
} from "./CarrierConnectionDrawer.tsx";
import { CarrierDataSyncDrawer } from "./CarrierDataSyncDrawer.tsx";
import styles from "./carrier-connections.module.css";
const TAB_ITEMS: readonly TabBarItem<CarrierQuery["status"]>[] = [
  { id: "all", title: "Tất cả tài khoản", icon: <Layers size={16} /> },
  {
    id: "CONNECTED",
    title: CONNECTION_STATES.CONNECTED.label,
    icon: <CircleCheck size={16} />,
  },
  {
    id: "ERROR",
    title: CONNECTION_STATES.ERROR.label,
    icon: <AlertCircle size={16} />,
  },
  {
    id: "REAUTH_REQUIRED",
    title: CONNECTION_STATES.REAUTH_REQUIRED.label,
    icon: <KeyRound size={16} />,
  },
];
type ActiveDrawer =
  | { type: RowAction; row: CarrierConnectionRow }
  | { type: "create" }
  | { type: "sync-overview" };
export function CarrierConnectionsPage({
  records,
  syncByConnection = {},
}: {
  records?: readonly CarrierConnectionRow[];
  syncByConnection?: Readonly<Record<string, SyncPresentation>>;
}) {
  const rows = records ?? [];
  const known = records !== undefined;
  const [query, setQuery] = useState<CarrierQuery>(INITIAL_QUERY);
  const [drawer, setDrawer] = useState<ActiveDrawer | null>(null);
  const change = (patch: Partial<CarrierQuery>) =>
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  const model = selectConnections(rows, query);
  const providers = [
    ...new Map(
      rows.map((row) => [
        row.provider,
        { id: row.provider, name: row.providerName },
      ]),
    ).values(),
  ];
  if (!providers.some((p) => p.id === "uniship"))
    providers.unshift({ id: "uniship", name: "Uniship" });
  const close = () => setDrawer(null);
  return (
    <section className={styles.page} data-carrier-connections>
      <div className={styles.pageHeader}>
        <div className={styles.heading}>
          <Link
            href="/settings"
            aria-label="Về Cài đặt"
            className={buttonClassName("ghost", true, "", "none")}
            data-size="default"
          >
            <ArrowLeft size={14} />
          </Link>
          <span className={styles.titleIcon}>
            <Truck size={20} />
          </span>
          <h1>KẾT NỐI HÃNG VẬN CHUYỂN</h1>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" disabled title={UNAVAILABLE}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
          <Button
            variant="emphasis"
            pressEffect="none"
            onClick={() => setDrawer({ type: "create" })}
          >
            <Plus size={14} />
            KẾT NỐI HÃNG MỚI
          </Button>
        </div>
      </div>
      <TabBar
        items={TAB_ITEMS}
        value={query.status}
        onValueChange={(status) => change({ status })}
        idPrefix="carrier-connections"
        panelId="carrier-connections-panel"
        ariaLabel="Trạng thái tài khoản kết nối"
        renderTrailing={(item, { active }) => (
          <TabCountBadge
            value={
              known
                ? rows.filter(
                    (row) => item.id === "all" || row.status === item.id,
                  ).length
                : undefined
            }
            active={active}
          />
        )}
      />
      <CarrierConnectionToolbar
        query={query}
        providers={providers}
        onChange={change}
      />
      <div className={styles.availability} role="status">
        <span>Chưa tích hợp dữ liệu. {UNAVAILABLE}</span>
        <Button
          variant="ghost"
          pressEffect="none"
          onClick={() => setDrawer({ type: "sync-overview" })}
        >
          Xem giao diện đồng bộ
        </Button>
      </div>
      <div
        id="carrier-connections-panel"
        role="tabpanel"
        aria-label={TAB_ITEMS.find((item) => item.id === query.status)?.title}
      >
        <CarrierConnectionTable
          model={model}
          known={known}
          sync={syncByConnection}
          onAction={(type, row) => setDrawer({ type, row })}
        />
        <CarrierConnectionPagination
          model={model}
          known={known}
          onChange={change}
        />
      </div>
      {drawer?.type === "create" && <CarrierConnectionDrawer onClose={close} />}
      {drawer?.type === "edit" && (
        <CarrierConnectionDrawer row={drawer.row} onClose={close} />
      )}
      {drawer?.type === "detail" && (
        <CarrierConnectionDetails row={drawer.row} onClose={close} />
      )}
      {drawer?.type === "disconnect" && (
        <CarrierConfirmDialog row={drawer.row} onClose={close} />
      )}
      {drawer?.type === "sync" && (
        <CarrierDataSyncDrawer
          row={drawer.row}
          data={syncByConnection[drawer.row.id]}
          onClose={close}
        />
      )}
      {drawer?.type === "sync-overview" && (
        <CarrierDataSyncDrawer onClose={close} />
      )}
    </section>
  );
}
