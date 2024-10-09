import { type Operation } from "npm:effection@3.0.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useEntries } from "../lib/useEntries.ts";
import { CommentCursor } from "./discussion.ts";
import chalk from "npm:chalk@5.3.0";

interface fetchCommentsOptions {
  incompleteComments: CommentCursor[];
  first?: number;
}

export function* fetchComments({
  incompleteComments,
  first = 50,
}: fetchCommentsOptions): Operation<void> {
  const entries = yield* useEntries();
  const graphql = yield* useGraphQL();

  let cursors: CommentCursor[] = incompleteComments;

  do {
    console.log(
      `Batch querying ${chalk.blue(cursors.length, "discussions")} for additional comments`,
    );
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
          discussionId: discussion.id,
          first,
          totalCount: discussion.comments.totalCount,
          endCursor: discussion.comments.pageInfo.endCursor,
        });
      }
      for (const comment of discussion.comments.nodes) {
        if (comment?.author) {
          yield* entries.send({
            type: "comment",
            id: comment.id,
            bodyText: comment.bodyText,
            author: comment.author.login,
            discussionNumber: comment.discussion.number,
          });
        } else {
          console.log(
            chalk.gray(`Skipped comment:${comment?.id} because author login is missing.`),
          );
        }
      };
    }
  } while (cursors.length > 0);
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
