/** Generic keyed read policy; request transport/generation fencing remains in the hook. */
export type ReadState<T, E> = {
  key: string;
  data?: T;
  error?: E;
  loading: boolean;
  requestId: number;
  settledId: number;
  denied: boolean;
  outcome?: "pending" | "success" | "error" | "idle";
};
export function beginRead<T, E>(
  previous: ReadState<T, E>,
  key: string,
  requestId: number,
): ReadState<T, E> {
  return {
    key,
    requestId,
    settledId: previous.settledId,
    loading: true,
    denied: false,
    outcome: "pending",
    data: previous.key === key && !previous.denied ? previous.data : undefined,
  };
}
export function acceptRead<T, E>(
  state: ReadState<T, E>,
  key: string,
  requestId: number,
  data: T,
): ReadState<T, E> {
  if (state.key !== key || state.requestId !== requestId) return state;
  return {
    ...state,
    data,
    error: undefined,
    loading: false,
    denied: false,
    outcome: "success",
    settledId: requestId,
  };
}
export function rejectRead<T, E>(
  state: ReadState<T, E>,
  key: string,
  requestId: number,
  error: E,
  denied = false,
): ReadState<T, E> {
  if (state.key !== key || state.requestId !== requestId) return state;
  return {
    ...state,
    data: denied ? undefined : state.data,
    error,
    loading: false,
    denied,
    outcome: "error",
    settledId: requestId,
  };
}
