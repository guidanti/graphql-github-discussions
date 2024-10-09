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

  do {
    const data = yield* graphql(
      `query BatchedComments {
        ${
        cursors.map((item, index) => `
        _${index}: node(id: "${item.discussionId}") {
        ... on Discussion {
          comments(first: ${item.first}, after: "${item.endCursor}") {
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

    console.log(data)
    // channel.send({ })

    // cursors = extractCursorsFrom(data);
    cursors = []
  } while (cursors.length > 0);

  return channel;
}

/**
 *  rateLimit {
 *    cost
 *    remaining
 *    nodeCount
 *  }
 */
