import {
  type Channel,
  createChannel,
  each,
  type Operation,
} from "npm:effection@3.0.3";
import { useCache } from "../lib/useCache.ts";
import { CommentCursor, DiscussionEntries } from "../types.ts";
import { useGraphQL } from "../lib/useGraphQL.ts";

export function* fetchComments(): Operation<Channel<DiscussionEntries, void>> {
  const cache = yield* useCache();
  const graphql = yield* useGraphQL();
  const channel = createChannel<DiscussionEntries>();

  let cursors: CommentCursor[] = [];

  for (
    const item of yield* each(
      yield* cache.read<CommentCursor>("./comments/_cursors"),
    )
  ) {
    cursors.push(item);
    yield* each.next();
  }

  interface RateLimit {
    cost: number;
    remaining: number;
    nodeCount: number;
  } // 🚨

  type BatchQuery = {
    [key: string]: {
      id: string;
      comments: {
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
          }
        }[];
      }
    }
  } & RateLimit; // 🚨

  do {
    const data: BatchQuery = yield* graphql(
      `query BatchedComments {
        ${
        cursors.map((item, index) => `
        _${index}: node(id: "${item.discussionId}") {
        ... on Discussion {
          id
          comments(first: ${item.first}, after: "${item.endCursor}") {
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

    cursors = []
    for (const [_, discussion] of Object.entries(data)) {
      if (discussion.comments.pageInfo.hasNextPage) {
        cursors.push({
          type: "comment-cursor",
          discussionId: discussion.id,
          first: 50,
          totalCount: discussion.comments.totalCount,
          hasNextPage: discussion.comments.pageInfo.hasNextPage,
          endCursor: discussion.comments.pageInfo.endCursor,
          after: undefined,
        });
      }
      for (const comment of discussion.comments.nodes) {
        if (comment?.author) {
          yield* channel.send({
            type: "comment",
            id: comment.id,
            bodyText: comment.bodyText,
            author: comment.author.login,
            discussionNumber: comment.discussion.number,
          });
        } else {
          console.log(
            `Skipped comment:${comment?.id} because author login is missing.`,
          );
        }
      };
    }
  } while (cursors.length > 0);

  return channel;
}
