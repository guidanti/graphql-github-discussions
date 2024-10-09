import { each, type Operation, type Stream } from "npm:effection@3.0.3";
import {
  CommentCursor,
  DiscussionCursor,
  DiscussionEntries,
} from "../types.ts";
import { useCache } from "./useCache.ts";

export function* writeEntries(
  items: Stream<DiscussionEntries, void>,
): Operation<void> {
  const cache = yield* useCache();

  let discussionCursor: DiscussionCursor | undefined;
  let commentCursor: CommentCursor | undefined;

  for (const item of yield* each(items)) {
    switch (item.type) {
      case "discussion-cursor":
        discussionCursor = item;
        break;
      case "discussion": {
        const key = `discussions/${discussionCursor?.after ?? "undefined"}`;

        yield* cache.write(
          key,
          item,
        );
        break;
      }
      case "comment-cursor":
        commentCursor = item;
        if (commentCursor.hasNextPage) {
          yield* cache.write(
            `comments/_cursors`,
            commentCursor,
          );
        }
        break;
      case "comment": {
        const key = `comments/${commentCursor?.discussionId}-${
          commentCursor?.after ?? "undefined"
        }`;
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
}
