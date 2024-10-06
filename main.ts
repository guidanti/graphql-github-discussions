import { main, each } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { allDiscussionComments } from './lib/allDiscussionComments.ts';



await main(function*() {
  yield* initGraphQLContext();

  const items = yield* allDiscussionComments({ org: "vercel", repo: "next.js", first: 10 });
  
  for (const item of yield* each(items)) {
    if (item.type === "discussion-cursor") {
      console.log(item)
    }
    yield* each.next();
  }

  // read all discussions
  // 
});
