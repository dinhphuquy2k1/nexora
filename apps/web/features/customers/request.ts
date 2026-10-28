/** One Customer read lane. Invalidation happens at the UI event, before debounce/effects. */
export class CustomerReadLane {
  private generation = 0;
  private key = "";
  private controller: AbortController | null = null;
  private disposed = false;
  invalidate() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }
  begin(key: string) {
    this.invalidate();
    this.disposed = false;
    this.key = key;
    this.controller = new AbortController();
    return { generation: this.generation, key, signal: this.controller.signal };
  }
  current(ticket: { generation: number; key: string }) {
    return (
      !this.disposed &&
      ticket.generation === this.generation &&
      ticket.key === this.key
    );
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
  }
}
