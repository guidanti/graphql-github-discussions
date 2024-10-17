import { assert } from "jsr:@std/assert";
import { main } from "npm:effection@3.0.3";
import { fetchGithubDiscussions } from "./fetchGithubDiscussions.ts";
import { forEach } from "./lib/forEach.ts";
import { createGithubGraphqlClient } from "./lib/useGraphQL.ts";

if (import.meta.main) {
  await main(function* () {
    const token = Deno.env.get("GITHUB_TOKEN");

    assert(
      token,
      "You need to have GITHUB_TOKEN configured in our local environment",
    );

    const client = createGithubGraphqlClient({
      endpoint: "https://api.github.com/graphql",
      token,
    });

    const results = yield* fetchGithubDiscussions({
      client,
      org: "vercel",
      repo: "next.js",
      discussionsBatchSize: 75,
      commentsBatchSize: 100,
      repliesBatchSize: 100,
    });

    yield* forEach(function* (result) {
      console.log(result);
    }, results);

    console.log("Done ✅");
  });
}
