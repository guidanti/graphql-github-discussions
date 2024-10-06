import { Comment } from './__generated__/types.ts';

export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Discussions($name: String!, $owner: String!, $after: String = "") {
    repository(name: $name, owner: $owner) {
      discussions(first: 100, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
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



export const COMMENTS_QUERY = /* GraphQL */ `
  query Comments($name: String!, $owner: String!, $number: Int!, $after: String!) {
    repository(name: $name, owner: $owner) {
      discussion(number: $number) {
        comments(first: 100, after: $after) {
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
    rateLimit {
      cost
      remaining
      nodeCount
    }
  }
`;

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
        let queryId = comment.id.replace(/[^a-zA-Z0-9_]/g, 'aaa');
        let nodeId = comment.id;
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
