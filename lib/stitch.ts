import { Comment } from "../types.ts";
import { Reply } from "../types.ts";
import { Discussion } from "../types.ts";
import { useCache } from "./useCache.ts";

export function* stitch() {
  const cache = yield* useCache();
  
  const discussionSubscription = yield* cache.find<Discussion>("discussions/*");
  let nextDiscussion = yield* discussionSubscription.next();

  while (!nextDiscussion.done) {
    const commentSubscription = yield* cache.find<Comment>(`discussions/${nextDiscussion.value.number}/*`);
    let nextComment = yield* commentSubscription.next();

    const comments = [];

    while (!nextComment.done) {
      const replySubscription = yield* cache.find<Reply>(`discussions/${nextDiscussion.value.number}/*/*`);
      let nextReply = yield* replySubscription.next();

      const replies = [];

      while (!nextReply.done) {
        replies.push(nextReply.value);
        nextReply = yield* replySubscription.next();
      }

      comments.push({
        ...nextComment.value,
        replies,
      });
      nextComment = yield* commentSubscription.next();
    }
    
    const discussion = {
      ...nextDiscussion.value,
      comments,
    };  // 🚨
    
    nextDiscussion = yield* discussionSubscription.next();
  }
}
