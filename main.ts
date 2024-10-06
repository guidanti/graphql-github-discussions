import { main } from "npm:effection@3.0.3";
import { initGraphQLContext } from "./lib/useGraphQL.ts";



await main(function*() {
  yield* initGraphQLContext();

  
  // read all discussions
  // 
});