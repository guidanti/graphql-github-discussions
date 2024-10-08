import { each } from "npm:effection@3.0.3";
import { useCache } from "../lib/useCache.ts";
import { CommentCursor } from "../types.ts";

export const COMMENTS_QUERY = /* GraphQL */ `
  query Comments($name: String!, $owner: String!, $number: Int!, $after: String!, $first: Int) {
    repository(name: $name, owner: $owner) {
      discussion(number: $number) {
        comments(first: $first, after: $after) {
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
  }
`;

export function* fetchComments() {
  const cache = yield *useCache();

  // let query = `

  //   rateLimit {
  //     cost
  //     remaining
  //     nodeCount
  //   }
  // `;
  // for (const item of yield* each(yield* cache.read<CommentCursor>('./comments/has-more'))) {
    
  //   yield* each.next();
  // }
}