import {
  createContext,
  Operation,
  resource,
} from "npm:effection@3.0.3";

export const LoggerContext = createContext<Console>(
  "logger",
);

export function createLogger() {
  return resource<Console>(
    function* (provide) {
      yield* provide(console);
    }
  );
}

export function* initLoggerContext(): Operation<
  Console
> {
  const logger = yield* createLogger();
  return yield* LoggerContext.set(logger);
}

export function* useLogger(): Operation<Console> {
  return yield* LoggerContext;
}
