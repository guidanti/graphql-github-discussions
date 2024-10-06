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

export function* allDiscussionComments({
  org,
  repo,
}: {
  org: string;
  repo: string;
}): Operation<Channel<Comment | Discussion, void>> {
  const channel = createChannel<Comment | Discussion>();
  
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
          if (discussion.author) {
            yield* channel.send({
              type: "discussion",
              number: discussion.number,
              title: discussion.title,
              url: discussion.url,
              bodyText: discussion.bodyText,
              author: discussion.author.login,
              category: discussion.category.name
            })
          } else {
            console.log(`Skipped discussion:${discussion?.number} because author login is missing.`)
          }
          // send a discussion here
          for (const comment of discussion?.comments.nodes ?? []) {
            if (comment?.author) {
              yield* channel.send({
                type: "comment",
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