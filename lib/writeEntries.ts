import { type Stream, each, type Operation } from "npm:effection@3.0.3";
import { CommentCursor, DiscussionCursor, DiscussionEntries } from "../types.ts";
import { useCache } from './useCache.ts';

export function* writeEntries(items: Stream<DiscussionEntries, void>): Operation<void> {
  const cache = yield* useCache();

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