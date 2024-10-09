import { each, type Operation } from "npm:effection@3.0.3";
import { useCache } from "../lib/useCache.ts";
import chalk from "npm:chalk@5.3.0";

export function* fetchReplies({
  first = 50,
}: {
  first?: number;
} = {}): Operation<void> {
  const cache = yield* useCache();
  const results = yield* cache.getAllFilePaths("./discussions");
  for (const result of yield* each(results)) {
    console.log(result);
    yield* each.next();
  }
}
