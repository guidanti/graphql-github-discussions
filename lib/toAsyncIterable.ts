import type { Scope, Stream } from "npm:effection@3.0.3";

export function toAsyncIterable<T>(stream: Stream<T, unknown>, scope: Scope): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      const subscription = await scope.run(() => stream);

      let next = await scope.run(subscription.next);

      while (true) {
        if (!next.done) {
          yield next.value;
        } else {
          break;
        }
        next = await scope.run(subscription.next);
      }
      return next.value;
    }
  }
}