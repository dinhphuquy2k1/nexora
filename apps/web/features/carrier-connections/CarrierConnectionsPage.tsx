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
  ShieldCheck,
  AlertTriangle,
  Link2,
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";
import type {
  CarrierConnectionRow,
  CarrierQuery,
  CarrierTab,
  CarrierProviderPresentation,
  SyncPresentation,
} from "./types.ts";
import {
  INITIAL_QUERY,
  selectConnections,
  tabMatches,
  addCarrierFilter,
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
const TABS: readonly TabBarItem<CarrierTab>[] = [
  {
    id: "all",
    title: "Tất cả tài khoản",
    activeIconColor: "var(--color-primary)",
    icon: <Layers size={14} />,
  },
  {
    id: "connected",
    title: "Đang hoạt động",
    activeIconColor: "var(--color-status-success-text)",
    icon: <ShieldCheck size={14} />,
  },
  {
    id: "needs_check",
    title: "Cần kiểm tra",
    activeIconColor: "var(--amber-700)",
    icon: <AlertTriangle size={14} />,
  },
  {
    id: "sandbox",
    title: "Sandbox",
    activeIconColor: "var(--color-carrier-sandbox-text)",
    icon: <Link2 size={14} />,
  },
];
type Surface =
  | { type: RowAction; row: CarrierConnectionRow }
  | { type: "create" };
export function CarrierConnectionsPage({
  records,
  syncByConnection = {},
  previewProviders,
}: {
  records?: readonly CarrierConnectionRow[];
  syncByConnection?: Readonly<Record<string, SyncPresentation>>;
  previewProviders?: readonly CarrierProviderPresentation[];
}) {
  const rows = records ?? [],
    known = records !== undefined;
  const [query, setQuery] = useState<CarrierQuery>(INITIAL_QUERY),
    [surface, setSurface] = useState<Surface | null>(null);
  const model = selectConnections(rows, query);
  const change = (patch: Partial<CarrierQuery>) =>
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  const close = () => setSurface(null);
  const providers = previewProviders
    ? [...previewProviders]
    : [
        ...new Map(
          rows.map((r) => [
            r.provider,
            {
              id: r.provider,
              name: r.providerName,
              code:
                r.preview?.code ??
                (r.provider === "uniship" ? "UNI" : r.provider.toUpperCase()),
            },
          ]),
        ).values(),
      ];
  if (!providers.some((p) => p.id === "uniship"))
    providers.unshift({ id: "uniship", name: "Uniship", code: "UNI" });
  return (
    <section className={styles.page} data-carrier-connections>
      <div className={styles.commandDeck} data-carrier-command-deck>
        <header className={styles.pageHeader}>
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
              <Truck size={18} />
            </span>
            <div className={styles.titleLine}>
              <h1>KẾT NỐI HÃNG VẬN CHUYỂN</h1>
              <span className={styles.activeBadge}>
                <span />
                {known
                  ? rows.filter((r) => tabMatches(r, "connected")).length
                  : "—"}{" "}
                tài khoản hoạt động
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              disabled
              title={UNAVAILABLE}
              aria-label="Xuất Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Xuất Excel</span>
            </Button>
            <Button
              variant="secondary"
              disabled
              title={UNAVAILABLE}
              aria-label="Làm mới trạng thái"
            >
              <RefreshCw size={14} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="emphasis"
              pressEffect="none"
              onClick={() => setSurface({ type: "create" })}
            >
              <Plus size={14} />
              Kết nối hãng mới
            </Button>
          </div>
        </header>
        <div className={styles.pageTabs}>
          <TabBar
            items={TABS.map((t) => ({
              ...t,
              disabled: t.id === "sandbox" && !known,
            }))}
            value={query.tab}
            onValueChange={(tab) => change({ tab })}
            idPrefix="carrier-connections"
            panelId="carrier-connections-panel"
            ariaLabel="Trạng thái tài khoản kết nối"
            renderTrailing={(item, { active }) => (
              <TabCountBadge
                active={active}
                value={
                  known
                    ? rows.filter((r) => tabMatches(r, item.id)).length
                    : undefined
                }
              />
            )}
          />
        </div>
        <CarrierConnectionToolbar
          query={query}
          providers={providers}
          known={known}
          total={model.total}
          allowEnvironment={known}
          onChange={change}
          onAdd={(filter) => {
            const next = addCarrierFilter(query.conditions, filter);
            if (!next) return false;
            change({ conditions: next });
            return true;
          }}
        />
      </div>
      <div
        className={styles.tableContainer}
        data-carrier-table-container
        id="carrier-connections-panel"
        role="tabpanel"
        aria-label={TABS.find((t) => t.id === query.tab)?.title}
      >
        <CarrierConnectionTable
          model={model}
          known={known}
          sync={syncByConnection}
          onAction={(type, row) => setSurface({ type, row })}
        />
        <CarrierConnectionPagination
          model={model}
          known={known}
          onChange={change}
        />
      </div>
      {surface?.type === "create" && (
        <CarrierConnectionDrawer providers={previewProviders} onClose={close} />
      )}{" "}
      {surface?.type === "edit" && (
        <CarrierConnectionDrawer
          row={surface.row}
          providers={previewProviders}
          onClose={close}
        />
      )}{" "}
      {surface?.type === "detail" && (
        <CarrierConnectionDetails
          row={surface.row}
          onEdit={() => setSurface({ type: "edit", row: surface.row })}
          onClose={close}
        />
      )}{" "}
      {surface?.type === "disconnect" && (
        <CarrierConfirmDialog row={surface.row} onClose={close} />
      )}{" "}
      {surface?.type === "sync" && (
        <CarrierDataSyncDrawer
          row={surface.row}
          data={syncByConnection[surface.row.id]}
          onClose={close}
        />
      )}
    </section>
  );
}
