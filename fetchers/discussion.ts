import { assert } from "jsr:@std/assert@1.0.3";
import {
  type Channel,
  createChannel,
  type Operation,
  spawn,
} from "npm:effection@3.0.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import type { DiscussionsQuery } from "../__generated__/types.ts";
import type { CURSOR_VALUE, DiscussionEntries } from "../types.ts";

export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Discussions($name: String!, $owner: String!, $after: String = "", $first: Int!) {
    repository(name: $name, owner: $owner) {
      discussions(first: $first, after: $after, orderBy: {
        field: CREATED_AT,
        direction: ASC,
      }) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          url
          bodyText
          number
          author {
            login
          }
          category {
            name
          }
          comments(first: 100) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ...DiscussionComment
            }
          }
        }
      }
    }
    rateLimit {
      cost
      remaining
      nodeCount
    }
  }

  fragment DiscussionComment on DiscussionComment {
    id
    bodyText
    author {
      login
    }
  }
`;


export function* fetchDiscussions({
  org,
  repo,
  first = 100,
}: {
  org: string;
  repo: string;
  first?: number;
}): Operation<Channel<DiscussionEntries, void>> {
  const channel = createChannel<DiscussionEntries>();

  const graphql = yield* useGraphQL();

  let hasNextPage: boolean;
  let after: CURSOR_VALUE = undefined;

  yield* spawn(function* () {
    let sofar = 0;
    do {
      const args = {
        owner: org,
        name: repo,
        first,
        after,
      };

      const data = yield* graphql<DiscussionsQuery>(DISCUSSIONS_QUERY, args);

      assert(data.repository, `Could not fetch ${org}/${repo}`);

      yield* channel.send({
        type: "discussion-cursor",
        after,
        first,
        totalCount: data.repository.discussions.totalCount,
        endCursor: data.repository.discussions.pageInfo.endCursor,
        hasNextPage: !!data.repository.discussions.pageInfo.hasNextPage,
      });
      console.log(
        `Fetched ${sofar += data.repository.discussions.nodes?.length ??
          0} of ${data.repository.discussions.totalCount} discussions for ${
          JSON.stringify(args)
        }`,
      );
      for (const discussion of data.repository.discussions.nodes ?? []) {
        if (discussion) {
          if (discussion.author) {
            yield* channel.send({
              type: "discussion",
              id: discussion.id,
              number: discussion.number,
              title: discussion.title,
              url: discussion.url,
              bodyText: discussion.bodyText,
              author: discussion.author.login,
              category: discussion.category.name,
            });
          } else {
            console.log(
              `Skipped discussion:${discussion.number} because author login is missing.`,
            );
          }
          yield* channel.send({
            type: "comment-cursor",
            discussionId: discussion.id,
            after: undefined,
            first,
            totalCount: discussion.comments.totalCount,
            hasNextPage: !!discussion.comments.pageInfo.hasNextPage,
            endCursor: discussion.comments.pageInfo.endCursor,
          });
          for (const comment of discussion?.comments.nodes ?? []) {
            if (comment?.author) {
              yield* channel.send({
                type: "comment",
                id: comment.id,
                bodyText: comment.bodyText,
                author: comment.author.login,
                discussionNumber: discussion?.number,
              });
            } else {
              console.log(
                `Skipped comment:${comment?.id} because author login is missing.`,
              );
            }
          }
        } else {
          console.log(`Received ${discussion} in ${after} of ${org}/${repo}`);
        }
      }
      hasNextPage = !!data.repository.discussions.pageInfo.hasNextPage;
      after = data.repository.discussions.pageInfo.endCursor;
    } while (hasNextPage);
    yield* channel.close();
  });

  return channel;
};
