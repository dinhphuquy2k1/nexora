export type ToastMessage = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};
export function enqueueToast(
  queue: readonly ToastMessage[],
  item: ToastMessage,
): readonly ToastMessage[] {
  if (!item.id || !item.message || queue.some((t) => t.id === item.id))
    return queue;
  const next = [...queue];
  if (next.length >= 6) {
    const expendable = next.findIndex((t) => t.tone !== "error");
    next.splice(Math.max(0, expendable), 1);
  }
  return [...next, { ...item, message: item.message.slice(0, 500) }];
}
export function dismissToast(queue: readonly ToastMessage[], id: string) {
  return queue.filter((t) => t.id !== id);
}
