import { Comment } from "../types.ts";
import { Reply } from "../types.ts";
import { Discussion } from "../types.ts";
import { useCache } from "./useCache.ts";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";

export function* stitch() {
  const cache = yield* useCache();
  const discussionSubscription = yield* cache.find<Discussion>("discussions/*");
  let nextDiscussion = yield* discussionSubscription.next();
  while (!nextDiscussion.done) {
    const comments = [];
    const commentSubscription = yield* cache.find<Comment>(`discussions/${nextDiscussion.value.number}/*`);
    let nextComment = yield* commentSubscription.next();
    while (!nextComment.done) {
      const replies = [];
      const replySubscription = yield* cache.find<Reply>(`discussions/${nextDiscussion.value.number}/${encodeHex(md5(nextComment.value.id))}`);
      let nextReply = yield* replySubscription.next();
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
    };
    console.log(discussion);
    nextDiscussion = yield* discussionSubscription.next();
  }
}
