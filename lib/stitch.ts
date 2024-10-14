import {
  DiscussionEntries,
  Comment,
  Discussion,
  Reply,
} from "../types.ts";
import { useCache } from "./useCache.ts";
import { useLogger } from "./useLogger.ts";

interface CommentWithReplies extends Comment {
  replies?: Reply[];
}

interface DiscussionResult extends Discussion {
  comments: CommentWithReplies[];
}

export function* stitch() {
  const cache = yield* useCache();
  const logger = yield* useLogger();
  
  const discussionSubscription = yield* cache.find<DiscussionEntries>("discussions/*");
  let nextDiscussion = yield* discussionSubscription.next();

  let current: number | undefined = undefined;
  let result = {} as DiscussionResult;
  let discussion = {} as Discussion;
  let comments = [] as CommentWithReplies[];
  
  while (!nextDiscussion.done) {
    const item = nextDiscussion.value;
    switch(item.type) {
      case "discussion": {
        if (current && current !== item.number) {
          result = {
            ...discussion,
            comments,
          } // 🚨 send as result
          comments = [];
        }
        discussion = item;
        current = item.number;
        break;
      }
      case "comment": {
        comments.push(item);
        break;
      }
      case "reply": {
        const comment = comments.find(comment => {
          return comment.id === item.parentCommentId;
        });
        if (comment && comment.replies) {
          comment.replies.push(item);
        } else if (comment) {
          comment.replies = [item];
        } else {
          logger.error("This could happen if parent comment author account is deleted.");
        }
        break;
      }
    }

    nextDiscussion = yield* discussionSubscription.next();
  }

  console.log(result); // 🚨 for the last discussion
}
