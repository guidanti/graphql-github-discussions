import { call, each, type Operation } from "npm:effection@3.0.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useCache } from "../lib/useCache.ts";
import { useEntries } from "../lib/useEntries.ts";
import { Comment, Cursor } from "../types.ts";
import chalk from "npm:chalk@5.3.0";
import { useLogger } from "../lib/useLogger.ts";

export function* fetchReplies({
  first = 50,
  batchSize = 50,
}: {
  first?: number;
  batchSize?: number;
} = {}): Operation<void> {
  const cache = yield* useCache();
  const entries = yield* useEntries();
  const graphql = yield* useGraphQL();
  const logger = yield* useLogger();

  let cursors: Cursor[] = [];
  const subscription = yield* cache.find<Comment>("discussions/*/*");

  let next = yield* subscription.next();
  while (!next.done) {
    const result = next.value;
    cursors.push({
      id: result.id,
      first,
      endCursor: null,
    });
    if (cursors.length === batchSize) {
      let repliesCount = 0;
      do {
        const data: CommentsBatchQuery = yield* graphql(
          `query BatchedComments {
            ${
            cursors.map((item, index) => `
            _${index}: node(id: "${item.id}") {
            ... on Comment {
              id
              replies(first: ${item.first}, after: "${item.endCursor}") {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  bodyText
                  author {
                    login
                  }
                  discussion {
                    number
                  }
                }
              }
            }
          }
        `).join("\n")
          }
            rateLimit {
              cost
              remaining
              nodeCount
            }
          }`,
          {},
        );

        delete data.rateLimit;
        cursors = [];

        for (const [_, comment] of Object.entries(data)) {
          if (comment.replies.pageInfo.hasNextPage) {
            cursors.push({
              id: comment.id,
              first,
              endCursor: comment.replies.pageInfo.endCursor,
            });
          }
          for (const reply of comment.replies.nodes) {
            if (reply?.author) {
              yield* entries.send({
                type: "reply",
                id: reply.id,
                bodyText: reply.bodyText,
                author: reply.author.login,
                parentCommentId: comment.id,
                discussionNumber: reply.discussion.number,
              });
            } else {
              logger.log(
                chalk.gray(
                  `Skipped comment:${comment?.id} because author login is missing.`,
                ),
              );
            }
          }
          repliesCount += comment.replies.nodes.length;
        }
      } while (cursors.length);
      logger.log(
        `Retrieved ${
          chalk.blue(repliesCount, repliesCount > 1 ? "replies" : "reply")
        } from batch query`,
      );
    }
    next = yield* subscription.next();
  }
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type CommentsBatchQuery = {
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
