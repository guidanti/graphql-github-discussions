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

        for(const _discussion of discussions) {
          if (_discussion) {
            const discussion = {
              title: _discussion.title,
              url: _discussion.url,
              bodyText: _discussion.bodyText,
              number: _discussion.number,
              author: _discussion.author?.login,
              category: _discussion.category?.name,
              comments: _discussion.comments.nodes ? [..._discussion.comments.nodes] : [],
            };
   
            let moreComments = _discussion.comments.pageInfo.hasNextPage;
            let lastCommentsCursor = _discussion.comments.pageInfo.endCursor;
    
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
                  discussion.comments.push(comment);
                });
              }
              lastCommentsCursor = repository?.discussion?.comments.pageInfo.endCursor;
              moreComments = false; // 🚨 repository?.discussion?.comments.pageInfo.hasNextPage
            }

            // 🚨 TODO: aggregate comments so that each bulk request fills up to the max size
            let commentsBatches = lodash.chunk(discussion.comments, 50);

            // 🔴 this will become redundant if we fill up to the max size
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
            // 🔴
            
            for (const commentBatch of commentsBatches) {
              const batchResults: any = await client(generateBatchQuery(commentBatch)); // 🚨 type
              
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
            results.push(discussion);
          }
        }
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
