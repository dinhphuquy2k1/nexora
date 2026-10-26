type Operation = {
  token: number;
  id: string;
  phase: "writing" | "revalidating" | "blocked";
  requestId: number;
};
/** Customer table gate; React state is a projection, never the synchronous write authority. */
export class CustomerPowerFlight {
  private sequence = 0;
  private active: Operation | null = null;
  begin(id: string) {
    if (this.active) return null;
    const token = ++this.sequence;
    this.active = { token, id, phase: "writing", requestId: 0 };
    return token;
  }
  matches(token: number) {
    return this.active?.token === token;
  }
  reconcile(token: number, requestId: number) {
    if (this.matches(token))
      this.active = { ...this.active!, phase: "revalidating", requestId };
  }
  reject(token: number) {
    if (this.matches(token)) this.active = null;
  }
  observe(
    read: {
      key: string;
      requestId: number;
      settledId: number;
      loading: boolean;
      outcome?: string;
    },
    key: string,
  ) {
    if (
      !this.active ||
      this.active.phase === "writing" ||
      read.key !== key ||
      read.loading ||
      read.settledId < this.active.requestId
    )
      return false;
    if (read.outcome === "success") {
      this.active = null;
      return true;
    }
    if (read.outcome === "error" && this.active.phase !== "blocked") {
      this.active = { ...this.active, phase: "blocked" };
      return true;
    }
    return false;
  }
  cancel() {
    this.sequence++;
    this.active = null;
  }
  snapshot() {
    return this.active ? { ...this.active } : null;
  }
}
