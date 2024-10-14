import { createQueue, spawn } from "npm:effection@3.0.3";
import { Comment, Discussion, DiscussionEntries, Reply } from "../types.ts";
import { useCache } from "./useCache.ts";
import { useEntries } from "./useEntries.ts";
import { useLogger } from "./useLogger.ts";
import { assert } from "jsr:@std/assert/assert";

interface CommentWithReplies extends Comment {
  replies: Reply[];
}

interface DiscussionResult extends Discussion {
  comments: CommentWithReplies[];
}

export function* stitch() {
  const cache = yield* useCache();
  const logger = yield* useLogger();
  const queue = createQueue<DiscussionResult, void>();

  const discussionSubscription = yield* cache.find<DiscussionEntries>(
    "discussions/*",
  );
  let nextDiscussion = yield* discussionSubscription.next();

  yield* spawn(function* () {
    let result: DiscussionResult | undefined;

    while (!nextDiscussion.done) {
      const item = nextDiscussion.value;
      switch (item.type) {
        case "discussion": {
          if (result && result.number !== item.number) {
            // encountered next discussion
            // emit the discussion before i
            queue.add(result);
          } else {
            result = {
              ...item,
              comments: [],
            };
          }
          break;
        }
        case "comment": {
          if (result) {
            result.comments.push({
              ...item,
              replies: [],
            });
          } else {
            logger.error(`Do not have a reference to the discussion for comment[${item.id}]`);
          }
          break;
        }
        case "reply": {
          if (result) {
            const comment = result.comments.find((comment) =>
              comment.id === item.parentCommentId
            );
            if (comment) {
              comment.replies.push(item);
            } else {
              logger.error(
                "Could not find comment for a reply, possibly, because the author account was deleted.",
              );
            }
          } else {
            logger.error(`Do not have a reference to the discussion for reply[${item.id}]`);
          }
          break;
        }
      }

      nextDiscussion = yield* discussionSubscription.next();
    }

    if (result) {
      queue.add(result);
    } else {
      logger.error(`Was expecting the last discussion result in the stitcher`)
    }

    queue.close();
  });

  return queue;
}
