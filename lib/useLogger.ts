import {
  createContext,
  Operation,
} from "npm:effection@3.0.3";

export const LoggerContext = createContext<Console>(
  "logger",
);

export function* initLoggerContext(logger: Console): Operation<
  Console
> {
  return yield* LoggerContext.set(logger);
}

export function* useLogger(): Operation<Console> {
  return yield* LoggerContext;
}
