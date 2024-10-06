import {
  createChannel,
  call,
  spawn,
  type Channel,
  type Operation,
} from "npm:effection@3.0.3";
import { useGraphQL } from "./useGraphQL.ts";
import type { DiscussionsQuery } from "../src/queries.__generated__.ts";
import { DISCUSSIONS_QUERY } from "../src/queries.ts";
import { assert } from "jsr:@std/assert@1.0.3";

interface Comment {
  type: "comment";
  id: string;
  bodyText: string;
  author: string;
  discussionNumber: number;
}

interface Discussion {
  type: "discussion";
  number: number;
  title: string;
  url: string;
  bodyText: string;
  author: string;
  category: string;
}

interface DiscussionCursor {
  type: "discussion-cursor";
  totalCount: number;
  after: CURSOR_VALUE;
  first: number;
  hasNextPage: boolean;
  endCursor: CURSOR_VALUE;
}

interface CommentCursor {
  discussion: number;
  type: "comment-cursor";
  totalCount: number;
  after: CURSOR_VALUE;
  first: number;
  hasNextPage: boolean;
  endCursor: CURSOR_VALUE;
}

/**
 * Start: undefined
 * Middle: string
 * Last: null
 */
type CURSOR_VALUE = string | null | undefined;

type DiscussionQueryValues =
  | Comment
  | Discussion
  | DiscussionCursor
  | CommentCursor;

export function* allDiscussionComments({
  org,
  repo,
  first = 100,
}: {
  org: string;
  repo: string;
  first?: number;
}): Operation<Channel<DiscussionQueryValues, void>> {
  const channel = createChannel<DiscussionQueryValues>();

  const graphql = yield* useGraphQL();

  let hasNextPage: boolean;
  let after: CURSOR_VALUE = undefined;

  yield* spawn(function* () {
    do {
      const args = {
        owner: org,
        name: repo,
        first,
        after,
      };
      const data = yield* call(() =>
        graphql<DiscussionsQuery>(DISCUSSIONS_QUERY, args)
      );

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
        `Fetched ${
          data.repository.discussions.nodes?.length
        } discussions for ${JSON.stringify(args)}`
      );
      for (const discussion of data.repository.discussions.nodes ?? []) {
        if (discussion) {
          if (discussion.author) {
            yield* channel.send({
              type: "discussion",
              number: discussion.number,
              title: discussion.title,
              url: discussion.url,
              bodyText: discussion.bodyText,
              author: discussion.author.login,
              category: discussion.category.name,
            });
          } else {
            console.log(
              `Skipped discussion:${discussion.number} because author login is missing.`
            );
          }
          yield* channel.send({
            discussion: discussion.number,
            type: "comment-cursor",
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
                `Skipped comment:${comment?.id} because author login is missing.`
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
}
