import { each, main } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import {
  allDiscussionComments,
  CommentCursor,
  DiscussionCursor,
} from "./lib/allDiscussionComments.ts";
import { initCacheContext } from "./lib/useCache.ts";

function* downloadDiscussions({ repo, org }: { repo: string; org: string }) {
  yield* initGraphQLContext();

  const cache = yield* initCacheContext({
    location: new URL(`./.cache/${org}/${repo}`, import.meta.url),
  });

  // read all discussions
  const items = yield* allDiscussionComments({
    org,
    repo,
    first: 50,
  });

  let discussionCursor: DiscussionCursor | undefined;
  let commentCursor: CommentCursor | undefined;

  for (const item of yield* each(items)) {
    switch (item.type) {
      case "discussion-cursor":
        discussionCursor = item;
        break;
      case "discussion":
        yield* cache.write(
          `discussions/${discussionCursor?.after ?? "undefined"}`,
          item,
        );
        break;
      case "comment-cursor":
        commentCursor = item;
        if (commentCursor.hasNextPage) {
          yield* cache.write(
            `comments/has-more`,
            commentCursor,
          );
        }
        break;
      case "comment":
        yield* cache.write(
          `comments/${commentCursor?.discussion}-${
            commentCursor?.after ?? "undefined"
          }`,
          item,
        );
        break;
    }
    yield* each.next();
  }
}

await main(function* () {
  yield* downloadDiscussions({
    org: "vercel",
    repo: "next.js",
  });
});
