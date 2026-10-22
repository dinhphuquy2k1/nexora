export function dockerCommand() {
  throw Error("Unexpected Docker invocation from a controlled fixture");
}
