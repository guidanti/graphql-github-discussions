import { createContext, type Operation } from "npm:effection@3.0.3";
import { graphql } from "npm:@octokit/graphql@4.8.0";
import { assert } from "jsr:@std/assert@1.0.3";

export const GraphQLContext = createContext<typeof graphql>("graphql");

export function* initGraphQLContext(): Operation<typeof graphql> {
  const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

  assert(GITHUB_TOKEN, "You need to have GITHUB_TOKEN configured in our local environment")

  const client = graphql.defaults({
    baseUrl: 'https://api.github.com',
    headers: {
      authorization: `token ${GITHUB_TOKEN}`,
    }
  });

  return yield* GraphQLContext.set(client);
}

export function* useGraphQL(): Operation<typeof graphql> {
  return yield* GraphQLContext;
}
