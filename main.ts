import { each, main, spawn } from "npm:effection@3.0.3";
import { fetchDiscussions, CommentCursor } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { fetchComments } from "./fetchers/comments.ts";
import { initEntriesContext } from "./lib/useEntries.ts";

await main(function* () {
  const cache = yield* initCacheContext({
    location: new URL(`./.cache/`, import.meta.url),
  });
  yield* initGraphQLContext();
  const entries = yield* initEntriesContext();

  yield* spawn(function* () {
    for (const item of yield* each(entries)) {
      switch (item.type) {
        case "discussion": {
          yield* cache.write(
            `discussions/${item.id}`,
            item,
          );
          break;
        }
        case "comment": {
          const key = `/discussions/${item?.discussionNumber}/${item.id}`;
          if (!(yield* cache.has(key))) {
            yield* cache.write(
              key,
              item,
            );
          }
          break;
        }
      }
      yield* each.next();
    }
  });

  const incompleteComments: CommentCursor[] = yield* fetchDiscussions({
    org: "vercel",
    repo: "next.js",
    first: 50,
  });

  yield* fetchComments({ incompleteComments });

  console.log("Done ✅");
});
