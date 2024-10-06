import {
  createChannel,
  call,
  spawn,
  type Channel,
  type Operation,
} from "npm:effection@3.0.3";
import { useGraphQL } from "./useGraphQL.ts";
import type {
  DiscussionsQuery,
} from "../src/queries.__generated__.ts";
import { DISCUSSIONS_QUERY } from "../src/queries.ts";

interface Comment {
  id: string;
  bodyText: string;
  author: string;
  discussionNumber: number;
}

export function* allDiscussionComments({
  org,
  repo,
}: {
  org: string;
  repo: string;
}): Operation<Channel<Comment, void>> {
  const channel = createChannel<Comment>();
  
  const graphql = yield* useGraphQL();

  let hasNextPage: boolean;
  let after: string | null | undefined = undefined;

  yield* spawn(function*() {
    do {
      const args = {
        owner: org,
        name: repo,
        after,
      };
      const data = yield* call(() =>
        graphql<DiscussionsQuery>(DISCUSSIONS_QUERY, args)
      );
      console.log(`Fetched ${data.repository?.discussions.nodes?.length} discussions for ${JSON.stringify(args)}`)
      for (const discussion of data.repository?.discussions.nodes ?? []) {
        if (discussion) {
          // send a discussion here
          for (const comment of discussion?.comments.nodes ?? []) {
            if (comment?.author) {
              yield* channel.send({
                id: comment.id,
                bodyText: comment.bodyText,
                author: comment.author.login,
                discussionNumber: discussion?.number
              });
            } else {
              console.log(`Skipped comment:${comment?.id} because author login is missing.`)
            }
          }
        } else {
          console.log(`Received ${discussion} in ${after} of ${org}/${repo}`);
        }
      }
      hasNextPage = !!data.repository?.discussions.pageInfo.hasNextPage;
      after = data.repository?.discussions.pageInfo.endCursor;
    } while (hasNextPage);
    yield* channel.close();
  })

  return channel;
};