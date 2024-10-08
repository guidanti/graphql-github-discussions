import { main } from "npm:effection@3.0.3";
import { fetchDiscussions } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { writeEntries } from "./lib/writeEntries.ts";

await main(function* () {
  yield* initCacheContext({
    location: new URL(`./.cache/`, import.meta.url),
  });

  yield* initGraphQLContext();
  yield* writeEntries(
    yield* fetchDiscussions({
      org: "vercel",
      repo: "next.js",
      first: 50,
    }),
  );
});
