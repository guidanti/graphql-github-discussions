import { each, type Operation } from "npm:effection@3.0.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useCache } from "../lib/useCache.ts";
import { useEntries } from "../lib/useEntries.ts";
import { chunk } from "jsr:@std/collections@1.0.7";
import { Comment } from "../types.ts";
import { CommentCursor } from "./discussion.ts";
import chalk from "npm:chalk@5.3.0";

export function* fetchReplies({
  first = 50,
  batch = 2,
}: {
  first?: number;
  batch?: number;
} = {}): Operation<void> {
  const cache = yield* useCache();
  const graphql = yield* useGraphQL();
  const entries = yield* useEntries();

  const results = yield* cache.find<Comment>("discussions/*/*");

  let subscription = yield* results;

  let next = yield* subscription.next();
  console.dir(next, { depth: 2 });

  while (!next.done) {
    console.dir(next, { depth: 2 });
    next = yield* subscription.next();
  }
  // for (const result of yield* each(results)) {
  //   console.log("loggint out results")
  //   console.log(result)
  //   yield* each.next();
  // }
  console.log("done with the operatin");
  // const batches = chunk(comments, batch);
  // for (const [index, batch] of batches.entries()) {
  //   let moreReplies: CommentCursor[] = [];
  //   do {
  //     console.log(
  //       `Batch querying for replies of all comments: batch ${chalk.blue(index + 1)} of ${chalk.blue(batches.length)}`,
  //     );
  //     for (const file of batch) {
  //       for (
  //         const data of yield* each(yield* cache.read<Comment>(file))
  //       ) {
  //         moreReplies.push({
  //           discussionId: data.id, // 🚨 rename to id?
  //           totalCount: 0, // 🚨 unnecessary
  //           first,
  //           endCursor: null,
  //         });
  //         yield* each.next();
  //       }
  //     }
  //     const data: BatchQuery = yield* graphql(
  //       `query BatchedComments {
  //         ${
  //           moreReplies.map((item, index) => `
  //           _${index}: node(id: "${item.discussionId}") {
  //           ... on Comment {
  //             id
  //             replies(first: ${item.first}, after: "${item.endCursor}") {
  //               totalCount
  //               pageInfo {
  //                 hasNextPage
  //                 endCursor
  //               }
  //               nodes {
  //                 id
  //                 bodyText
  //                 author {
  //                   login
  //                 }
  //                 discussion {
  //                   number
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       `).join("\n")
  //         }
  //           rateLimit {
  //             cost
  //             remaining
  //             nodeCount
  //           }
  //         }`,
  //       {},
  //     );

  //     delete data.rateLimit;
  //     moreReplies = [];

  //     let repliesCount = 0;
  //     for (const [_, comment] of Object.entries(data)) {
  //       if (comment.replies.pageInfo.hasNextPage) {
  //         moreReplies.push({
  //           discussionId: comment.id, // 🚨 rename to id?
  //           totalCount: 0, // 🚨 unnecessary
  //           first,
  //           endCursor: comment.replies.pageInfo.endCursor,
  //         });
  //       }
  //       repliesCount += comment.replies.nodes.length;
  //       for (const reply of comment.replies.nodes) {
  //         if (reply?.author) {
  //           yield* entries.send({
  //             type: "reply",
  //             bodyText: reply.bodyText,
  //             author: reply.author.login,
  //             parentCommentId: comment.id,
  //             discussionNumber: reply.discussion.number,
  //           });
  //         } else {
  //           console.log(
  //             chalk.gray(`Skipped comment:${comment?.id} because author login is missing.`),
  //           );
  //         }
  //       }
  //     }
  //     console.log(
  //       `Retrieved ${chalk.blue(repliesCount, repliesCount > 1 ? "replies" : "reply")} from batch query`,
  //     );
  //   } while (moreReplies.length > 0);
  // }
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type BatchQuery = {
  [key: string]: {
    id: string;
    replies: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: {
        id: string;
        bodyText: string;
        author: {
          login: string;
        };
        discussion: {
          number: number;
        };
      }[];
    };
  };
} & RateLimit; // 🚨
