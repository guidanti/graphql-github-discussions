import { main } from "npm:effection@3.0.3";
import { fetchGithubDiscussions } from "./fetchGithubDiscussions.ts";
import { forEach } from "./lib/forEach.ts";

if (import.meta.main) {
  await main(function* () {
    const results = yield* fetchGithubDiscussions();

    yield* forEach(function* (result) {
      console.log(result)
    }, results);

    console.log("Done ✅");
  });
}
