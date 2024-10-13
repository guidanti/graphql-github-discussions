import { Operation, race, sleep } from "npm:effection@3.0.3";

export function* retryWithBackoff<T>(fn: () => Operation<T>, options: { timeout: number }) {
  function* body() {
    let attempt = -1;

    while (true) {
      try {
        return yield* fn();
      } catch {
        let delayMs: number;
        
        // https://aws.amazon.com/ru/blogs/architecture/exponential-backoff-and-jitter/
        const backoff = Math.pow(2, attempt) * 1000;
        delayMs = Math.round((backoff * (1 + Math.random())) / 2);

        yield* sleep(delayMs);
        attempt++;
      }
    }
  }

  yield* race([
    body(),
    sleep(options.timeout)
  ]);
}