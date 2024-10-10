import { each, main, spawn } from "npm:effection@3.0.3";
import { fetchDiscussions } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { fetchComments } from "./fetchers/comments.ts";
import { fetchReplies } from "./fetchers/replies.ts";
import { initEntriesContext } from "./lib/useEntries.ts";
import { Cursor } from "./types.ts";

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
            `discussions/${item.number}`,
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
        case "reply": {
          const key = `/discussions/${item?.discussionNumber}/${item.parentCommentId}/${item.id}`;
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

  const incompleteComments: Cursor[] = yield* fetchDiscussions({
    org: "vercel",
    repo: "next.js",
    first: 50,
  });

  yield* fetchComments({ incompleteComments });

  yield* fetchReplies();

  console.log("Done ✅");
});
