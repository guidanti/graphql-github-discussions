import { each, main } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { allDiscussionComments } from "./lib/allDiscussionComments.ts";
import { initCacheContext } from "./lib/useCache.ts";

await main(function* () {
  yield* initGraphQLContext();
  const { discussions, comments } = yield* initCacheContext({
    location: new URL(".", import.meta.url),
  });

  // read all discussions
  const items = yield* allDiscussionComments({
    org: "vercel",
    repo: "next.js",
    first: 10,
  });

  for (const item of yield* each(items)) {
    switch (item.type) {
      case "discussion":
      case "discussion-cursor":
        yield* discussions.write(item);
        break;
      case "comment":
      case "comment-cursor":
        yield* comments.write(item);
        break;
    }
    yield* each.next();
  }

  // caching mechanism
  // calculating cost

  // fetch remaining comments
  // fetch all replies for all comments (batch query)
  // stitch data together
});
