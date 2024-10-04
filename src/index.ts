import { graphql } from "@octokit/graphql";
import { Comment, Discussion, DiscussionComment } from './__generated__/types'; // 🚨 hmmm
import lodash from "lodash";
import {
  RateLimit,
  tally,
} from "./calculator";

import {
  DiscussionsQuery,
  CommentsQuery,
  RepliesQuery,
} from './queries.__generated__';
import {
  DISCUSSIONS_QUERY,
  COMMENTS_QUERY,
  generateBatchQuery,
  REPLIES_QUERY,
} from "./queries";

import fs from 'fs';

async function execute() {
  const client = graphql.defaults({
    baseUrl: 'https://api.github.com',
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    }
  });
  const repo = "next.js";
  const org = "vercel";

  let bookkeeping = [] as RateLimit[];
  let totalbook = [] as RateLimit[];
  const ah = [] as any[];

  // 🟢 loop discussion batch
  let hasNext = true;
  let afterz = "";
  try {
    while(hasNext) {
      const {
        repository,
        rateLimit,
      } = await client<DiscussionsQuery>(DISCUSSIONS_QUERY, {
        name: repo,
        owner: org,
        after: afterz,
      });
      if (rateLimit) {
        bookkeeping.push(rateLimit);
      }
      const nodes = repository?.discussions?.nodes;
      if (nodes && nodes.length) {
        let discussionNumbers = nodes.reduce((acc, node) => {
          if (node) {
            return [...acc, node.number];
          }
          return acc;
        }, [] as number[])
        console.log("Querying", discussionNumbers);
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
  
          let commentsBatches = lodash.chunk(discussion.comments, 50);
          if (commentsBatches.length > 1) {
            let lastBatch = commentsBatches.pop();
            if ((lastBatch.length / commentsBatches.length) < 5) {
              lastBatch.forEach((comment, index) => {
                commentsBatches[index % commentsBatches.length].push(comment);
              });
            } else {
              commentsBatches.push(lastBatch);
            }  
          }
          for (const commentBatch of commentsBatches) {
            const BATCH_QUERY = generateBatchQuery(commentBatch);
            const batch: any = await client(BATCH_QUERY); // 🚨 type
            
            const rateLimit = batch.rateLimit;
            delete batch.rateLimit;
            
            bookkeeping.push(rateLimit);
  
            const batchSplit: [ // 🚨 type
              string,
              {
                id,
                replies: {
                  pageInfo: {
                    hasNextPage: boolean,
                    endCursor: string,
                  },
                  nodes: DiscussionComment[],
                }
              }
            ][] = Object.entries(batch);
  
            for (const [_, result] of batchSplit) {
              let hasNextPageOfReplies = result.replies.pageInfo.hasNextPage;
              let cursor = result.replies.pageInfo.endCursor;
              while (hasNextPageOfReplies) {
                if (result.replies.pageInfo.hasNextPage) {
                  const { node: { replies }, rateLimit }: Replies = await client(REPLIES_QUERY, {
                    id: result.id,
                    after: cursor,
                  });
                  bookkeeping.push(rateLimit);
                  if (replies.nodes && replies.nodes.length) {
                    result.replies.nodes.push(...replies.nodes);
                  }
                  hasNextPageOfReplies = replies.pageInfo.hasNextPage;
                  cursor = replies.pageInfo.endCursor;
                } else {
                  hasNextPageOfReplies = false;
                }
              }
              const discussionComment = discussion.comments.find(comment => comment?.id === result.id);
              if (discussionComment) {
                discussionComment.replies = { nodes: result.replies.nodes, totalCount: 0, pageInfo: { hasPreviousPage: false, hasNextPage: false, endCursor: "" } };
              }
            }
          }
          ah.push(discussion);
        }
      }
      afterz = repository?.discussions.pageInfo.endCursor || "";
      if (!repository?.discussions.pageInfo.hasNextPage) {
        hasNext = false
      }
      console.log(tally(bookkeeping));
      totalbook = [...bookkeeping];
      bookkeeping = [];
    }
    fs.writeFileSync('test.json', JSON.stringify({ data: ah }, null, 2))
  } catch(e) {
    console.log("something went wrong", e);
  } finally {
    console.log(tally(totalbook));
  }
}

interface Replies {
  node: {
    replies: {
      nodes:  DiscussionComment[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      }
    }
  };
  rateLimit: {
    cost: number;
    remaining: number;
    nodeCount: number;
  }
}

execute();
