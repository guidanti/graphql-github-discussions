import { graphql } from "@octokit/graphql";
import { DiscussionComment } from './__generated__/types';
import lodash from "lodash";
import {
  RateLimit,
  tally,
} from "./calculator";

import {
  DiscussionsQuery,
  CommentsQuery,
  // RepliesQuery, // 🚨 see comments below
} from './queries.__generated__';
import {
  DISCUSSIONS_QUERY,
  COMMENTS_QUERY,
  generateBatchQuery,
  REPLIES_QUERY,
} from "./queries";

import fs from 'fs';

async function execute() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("You need to have GITHUB_TOKEN configured in our local environment");
  }
  const client = graphql.defaults({
    baseUrl: 'https://api.github.com',
    headers: {
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    }
  });
  const repo = "next.js";
  const org = "vercel";

  let discussionBatchCost = [] as RateLimit[];
  let totalCost = [] as RateLimit[];
  const results = [] as any[];

  let moreDiscussions = true;
  let lastDiscussionCursor = "";
  try {
    // paginating through discussions to get all of the discussions
    while(moreDiscussions) {
      const {
        repository,
        rateLimit,
      } = await client<DiscussionsQuery>(DISCUSSIONS_QUERY, {
        name: repo,
        owner: org,
        after: lastDiscussionCursor,
      });
      if (rateLimit) {
        // cost for querying 100 discussions and first 100
        // comments (id, body, author) of each discussion - without replies
        discussionBatchCost.push(rateLimit);
      }
      const discussions = repository?.discussions?.nodes;

      if (discussions && discussions.length) {
        console.log("Querying:", discussions.reduce((acc, discussion) => {
          if (discussion) {
            return [...acc, discussion.number];
          }
          return acc;
        }, [] as number[]));

        // 
        for(const discussion of discussions) {
          if (discussion) {
            let moreComments = discussion.comments.pageInfo.hasNextPage;
            let lastCommentsCursor = discussion.comments.pageInfo.endCursor;
    
            // only loops if there are more than 100 comments in the discussion
            // shouldn't need to queue this up into batches as there probably
            // won't be that many discussions with more than 100 comments
            while(moreComments) {
              const {
                repository,
                rateLimit,
              } = await client<CommentsQuery>(COMMENTS_QUERY, {
                name: repo,
                owner: org,
                number: discussion.number,
                after: lastCommentsCursor,
              });
              if (rateLimit) {
                discussionBatchCost.push(rateLimit)
              }
              if (repository?.discussion?.comments.nodes) {
                repository?.discussion?.comments.nodes.forEach(comment => {
                  if (discussion?.comments?.nodes?.length) {
                    discussion.comments.nodes.push(comment);
                  }
                });
              }
              lastCommentsCursor = repository?.discussion?.comments.pageInfo.endCursor;
              moreComments = false; // 🚨 repository?.discussion?.comments.pageInfo.hasNextPage
            }
          }
        }

        // 🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡
        const allCommentsOfThisBatchOfDiscussions = discussions
          .flatMap((discussion) => {
            if (discussion?.__typename === "Discussion") {
              return {
                
              }
            }
          })
        
        // .reduce((acc, discussion) => {
        //   if (discussion && discussion.number && discussion.comments) {
        //     return [...acc, {
        //       number: discussion.number,
        //       comments: discussion.comments.nodes || [],
        //     }];
        //   } else {
        //     return acc;
        //   }
        // }, []);

        console.dir({ allCommentsOfThisBatchOfDiscussions }, { depth: 10 })

        // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
        let commentsBatches = lodash.chunk(allCommentsOfThisBatchOfDiscussions, 50);
        for (const commentBatch of commentsBatches) {
          const BATCH_QUERY = generateBatchQuery(commentBatch)
          const batchResults: any = await client(BATCH_QUERY); // 🚨 type
          throw new Error(BATCH_QUERY);
          
          discussionBatchCost.push(batchResults.rateLimit);
          delete batchResults.rateLimit;

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
          ][] = Object.entries(batchResults);
          
          for (const [_, comment] of batchSplit) {
            let moreReplies = comment.replies.pageInfo.hasNextPage;
            let lastRepliesCursor = comment.replies.pageInfo.endCursor;

            // only loops if there are more than 100 replies in a comment
            while (moreReplies) {
              // 🚨 can't use generated RepliesQuery from __generated because it doesn't recognize `... on DiscussionComment`: says `replies` does not exist
              const { node: { replies }, rateLimit }: Replies = await client(REPLIES_QUERY, {
                id: comment.id,
                after: lastRepliesCursor,
              });
              discussionBatchCost.push(rateLimit);

              if (replies.nodes && replies.nodes.length) {
                comment.replies.nodes.push(...replies.nodes);
              }
              moreReplies = replies.pageInfo.hasNextPage;
              lastRepliesCursor = replies.pageInfo.endCursor;
            }
            const discussionComment = discussion.comments.find(_comment => _comment?.id === comment.id) as DiscussionComment;
            if (discussionComment) {
              discussionComment.replies = {
                nodes: comment.replies.nodes,
                totalCount: 0,
                pageInfo: {
                  hasPreviousPage: false,
                  hasNextPage: false,
                  endCursor: ""
                }
              };
            }
          }
        }


        // 🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
        results.push(...discussions);
      }
      lastDiscussionCursor = `${repository?.discussions.pageInfo.endCursor}`;
      if (!repository?.discussions.pageInfo.hasNextPage) {
        moreDiscussions = false
      }
      console.log(tally(discussionBatchCost));
      totalCost = [...discussionBatchCost];
      discussionBatchCost = [];
    }
    fs.writeFileSync('test.json', JSON.stringify({ data: results }, null, 2));
  } catch(err) {
    console.error(err);
  } finally {
    console.log(tally(totalCost));
  }
}

// 🚨 can't use generated RepliesQuery from __generated because it doesn't recognize `... on DiscussionComment`: says `replies` does not exist
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
