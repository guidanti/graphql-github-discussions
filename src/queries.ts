export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Discussions($name: String!, $owner: String!, $after: String = "") {
    repository(name: $name, owner: $owner) {
      discussions(first: 10, after: $after) {
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
          comments(first: 10) {
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

export const COMMENTS_QUERY = /* GraphQL */ `
  query Comments($name: String!, $owner: String!, $number: Int!, $after: String!) {
    repository(name: $name, owner: $owner) {
      discussion(number: $number) {
        comments(first: 10, after: $after) {
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
