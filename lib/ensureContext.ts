import type { Context as ContextType, Operation } from "npm:effection@3.0.3";

function isMissingContextError(
  error: unknown,
): error is { name: "MissingContextError" } {
  return error != null &&
    (error as { name: string }).name === "MissingContextError";
}

export function* ensureContext<T>(Context: ContextType<T>, init: Operation<T>) {
  try {
    return yield* Context;
  } catch (e) {
    if (isMissingContextError(e)) {
      return yield* Context.set(yield* init);
    }
    throw e;
  }
}