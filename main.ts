import { main, each } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { allDiscussionComments } from './lib/allDiscussionComments.ts';



await main(function*() {
  yield* initGraphQLContext();

  const comments = yield* allDiscussionComments({ org: "vercel", repo: "next.js" });
  
  for (const comment of yield* each(comments)) {
    yield* each.next();
  }

  // read all discussions
  // 
});
