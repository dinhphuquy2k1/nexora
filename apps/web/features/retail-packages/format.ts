/** Exact lexical formatting: no floating point, monetary arithmetic or rounding. */
function parts(value: string) {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match) throw Error("INVALID_DECIMAL");
  return { sign: match[1], integer: match[2], fraction: match[3] ?? "" };
}
const grouped = (integer: string, separator: string) =>
  integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
export function formatWeight(value: string | null): string {
  if (value === null) return "—";
  const p = parts(value);
  let fraction = p.fraction.replace(/0+$/, "");
  while (fraction.length < 2) fraction += "0";
  return p.sign + p.integer + "." + fraction;
}
export function formatMoney(
  value: string | null,
  currency: string | null,
): string {
  if (value === null || currency === null) return "—";
  const p = parts(value);
  let fraction = p.fraction.replace(/0+$/, "");
  if (currency === "CNY") {
    if (!fraction) fraction = "0";
    return "¥" + p.sign + grouped(p.integer, ",") + "." + fraction;
  }
  if (currency === "VND")
    return (
      p.sign + grouped(p.integer, ".") + (fraction ? "," + fraction : "") + "đ"
    );
  if (!fraction) fraction = "0";
  return p.sign + grouped(p.integer, ",") + "." + fraction + " " + currency;
}
export function formatDate(value: string | null, withTime = false): string {
  if (value === null) return "—";
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  });
  const p = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  const day = `${p.day}/${p.month}/${p.year}`;
  return withTime ? `${day} ${p.hour}:${p.minute}` : day;
}
