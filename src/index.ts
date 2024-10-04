import { graphql } from "@octokit/graphql";
import { Discussion } from './__generated__/types'; // 🚨 hmmm
import {
  RateLimit,
  tally,
} from "./calculator";

import {
  DiscussionsQuery,
  CommentsQuery,
} from './queries.__generated__';
import {
  DISCUSSIONS_QUERY,
  COMMENTS_QUERY,
} from "./queries";

function batchQuery(ids: string[]) { // 🚨 hmmm type?
  return `
    query {
      ${ids.reduce((acc, id) => {
        return acc.concat(`${id}: node(id: "${id}") {
          ... on DiscussionComment {
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
          rateLimit {
            cost
            remaining
            nodeCount
          }
        }`)
      }, "")}
    }
  `;
}

async function execute() {
  const client = graphql.defaults({
    baseUrl: 'https://api.github.com',
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    }
  });
  const repo = "next.js";
  const org = "vercel";

  const bookkeeping = [] as RateLimit[];

  // 🟢 loop discussion batch
  // let hasNext = true;
  // while(hasNext) {
  // 🟢

  const {
    repository,
    rateLimit,
  } = await client<DiscussionsQuery>(DISCUSSIONS_QUERY, {
    name: repo,
    owner: org,
  });
  if (rateLimit) {
    bookkeeping.push(rateLimit);
  }

  const nodes = repository?.discussions?.nodes;
  if (nodes && nodes.length) {
    for(const node of nodes) {
      const {
        title,
        url,
        bodyText,
        number,
        author,
        category,
        comments,
      } = node as Discussion;

      let discussion = {
        title,
        url,
        bodyText,
        number,
        author: author?.login,
        category: category?.name,
        comments: comments.nodes ? [...comments.nodes] : [],
      };

      let nextPage = comments.pageInfo.hasNextPage;
      let after = comments.pageInfo.endCursor;

      while(nextPage) {
        const {
          repository,
          rateLimit,
        } = await client<CommentsQuery>(COMMENTS_QUERY, {
          name: repo,
          owner: org,
          number,
          after,
        });
        if (rateLimit) {
          bookkeeping.push(rateLimit)
        }
        const {
          comments,
        } = repository?.discussion as Discussion;
        if (comments.nodes) {
          comments.nodes.forEach(comment => {
            discussion.comments.push(comment);
          });
        }
        after = comments.pageInfo.endCursor;
        nextPage = false; // comments.pageInfo.hasNextPage
      }

      // split comments into batches of X
      // query batches of X
      // loop over each object of result data (key of object is the id of comment)
        // if there are more replies, do another query of replies for that one comment
        // let comment = discussion.comments.find(key)
        // comment.replies = object.data
    }
  }
  // 🟢 loop discussion batch
  // if (!repository?.discussions.pageInfo.hasNextPage) {
  //   hasNext = false
  // }
  // }
  // 🟢
  console.log(tally(bookkeeping));
}

execute();
