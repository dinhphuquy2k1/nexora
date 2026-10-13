import { STATUS_TABS, type ParcelStatus } from "../types.ts";
import styles from "../parcels.module.css";

interface ParcelStatusTabsProps {
  activeTab: ParcelStatus;
  statusCounts: Record<ParcelStatus, number>;
  onSelectTab: (tab: ParcelStatus) => void;
}

export function ParcelStatusTabs({
  activeTab,
  statusCounts,
  onSelectTab,
}: ParcelStatusTabsProps) {
  return (
    <nav
      className={styles.tabsNav}
      role="tablist"
      aria-label="Lọc theo trạng thái kiện hàng"
    >
      {STATUS_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = statusCounts[tab.key] ?? 0;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.key}`}
            aria-controls="parcel-list-panel"
            className={`${styles.tabButton} ${
              isActive ? styles.tabButtonActive : ""
            }`}
            onClick={() => onSelectTab(tab.key)}
          >
            <span className={styles.tabLabel}>{tab.label}</span>
            <span
              className={`${styles.tabCount} ${
                isActive ? styles.tabCountActive : ""
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
