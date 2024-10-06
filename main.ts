import { main, each } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";
import { allDiscussionComments } from './lib/allDiscussionComments.ts';
import { useSerializeJsonLines } from './lib/useSerializeJsonLines.ts';

await main(function*() {
  yield* initGraphQLContext();

  // read all discussions
  const items = yield* allDiscussionComments({ org: "vercel", repo: "next.js", first: 10 });
  
  const cache = {
    discussions: yield* useSerializeJsonLines(new URL(`./discussions.jsonlines`, import.meta.url)),
    comments: yield* useSerializeJsonLines(new URL(`./comments.jsonlines`, import.meta.url)),
  };

  for (const item of yield* each(items)) {
    switch(item.type){
      case "discussion":
      case "discussion-cursor":
        yield* cache.discussions.write(item);
        break;
      case "comment":
      case "comment-cursor":
        yield* cache.comments.write(item);
        break;
    }
    yield* each.next();
  }

  // caching mechanism
  // calculating cost

  // fetch remaining comments
  // fetch all replies for all comments (batch query)
  // stitch data together
});
