import type { ReactNode } from "react";
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function StatusBadge({
  ok,
  children,
}: {
  ok: boolean | null;
  children: ReactNode;
}) {
  return (
    <span
      className={`badge ${ok === true ? "good" : ok === false ? "bad" : "pending"}`}
    >
      {children}
    </span>
  );
}
