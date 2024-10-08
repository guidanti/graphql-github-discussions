import { Comment } from './__generated__/types.ts';



export const REPLIES_QUERY = /* GraphQL */ `
  query Replies($id: ID!, $after: String!) {
    node(id: $id) {
      ... on DiscussionComment {
        replies(first: 100, after: $after) {
          nodes {
            bodyText
            author {
              login
            }
          }
          pageInfo {
            hasNextPage
            endCursor
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
`;

export function generateBatchQuery(comments: Comment[]) { // 🚨 can't generate types
  const BATCH_QUERY = `
    query {
      rateLimit {
        cost
        remaining
        nodeCount
      }
      ${comments.reduce((acc, comment) => {
        const queryId = comment.id.replace(/[^a-zA-Z0-9_]/g, 'aaa');
        const nodeId = comment.id;
        return acc.concat(`${queryId}: node(id: "${nodeId}") {
          ... on DiscussionComment {
            id
            discussion {
              number
            }
            replies(first: 100) {
              nodes {
                bodyText
                author {
                  login
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }`)
      }, "")}
    }
  `;
  return BATCH_QUERY;
}
