import { each, main, spawn } from "npm:effection@3.0.3";
import { fetchDiscussions } from "./fetchers/discussion.ts";
import { initCacheContext } from "./lib/useCache.ts";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { fetchComments } from "./fetchers/comments.ts";
import { fetchReplies } from "./fetchers/replies.ts";
import { initEntriesContext } from "./lib/useEntries.ts";
import { Cursor } from "./types.ts";
import { initLoggerContext } from "./lib/useLogger.ts";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";
import { initRetryWithBackoff } from "./lib/useRetryWithBackoff.ts";
import { stitch } from "./lib/stitch.ts";

await main(function* () {
  yield* initRetryWithBackoff();

  const logger = yield* initLoggerContext(console);
  const cache = yield* initCacheContext({
    location: new URL(`./.cache/`, import.meta.url),
  });

  yield* initGraphQLContext();

  const entries = yield* initEntriesContext();

  yield* spawn(function* () {
    for (const item of yield* each(entries)) {
      switch (item.type) {
        case "discussion": {
          const key =  `discussions/${item.number}`;
          if (!(yield* cache.has(key))) {
            yield* cache.write(
              `discussions/${item.number}`,
              item,
            );
          }
          break;
        }
        case "comment": {
          const key = `/discussions/${item?.discussionNumber}/${encodeHex(md5(item.id))}`;
          if (!(yield* cache.has(key))) {
            yield* cache.write(
              key,
              item,
            );
          }
          break;
        }
        case "reply": {
          const key = `/discussions/${item?.discussionNumber}/${encodeHex(md5(item.parentCommentId))}/${encodeHex(md5(item.id))}`;
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
    first: 75,
  });

  yield* fetchComments({ 
    incompleteComments,
    first: 100, 
  });

  yield* fetchReplies({
    first: 100
  });

  yield* stitch();

  logger.log("Done ✅");
});
