import { call, createContext, each, type Operation } from "npm:effection@3.0.3";
import { graphql } from "npm:@octokit/graphql@4.8.0";
import { RequestParameters } from "npm:@octokit/types@13.6.1";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";
import chalk from "npm:chalk@5.3.0";

import { assert } from "jsr:@std/assert@1.0.3";
import { initCacheContext, useCache } from "./useCache.ts";

type GraphQLQueryFunction = <ResponseData>(
  query: string,
  parameters?: RequestParameters,
) => Operation<ResponseData>;

export const GraphQLContext = createContext<GraphQLQueryFunction>("graphql");

export function* initGraphQLContext(): Operation<GraphQLQueryFunction> {
  const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

  assert(
    GITHUB_TOKEN,
    "You need to have GITHUB_TOKEN configured in our local environment",
  );

  return yield* GraphQLContext.set(
    yield* call(function* () {
      const currentCache = yield* useCache();

      const cache = yield* initCacheContext({
        location: new URL("./github/", currentCache.location),
      });

      const client = graphql.defaults({
        baseUrl: "https://api.github.com",
        headers: {
          authorization: `token ${GITHUB_TOKEN}`,
          "X-Github-Next-Global-ID": 1,
        },
      });

      return function* query<ResponseData>(
        query: string,
        parameters: RequestParameters = {},
        ): Operation<ResponseData> {
          const key = `${encodeHex(md5(query))}-${
            Object.keys(parameters).map((p) => `${p}:${parameters[p]}`).join("-")
          }`;

        if (yield* cache.has(key)) {
          for (
            const data of yield* each(yield* cache.read<ResponseData>(key))
          ) {
            return data;
          }
          console.error(`This could happen if cached document had no records.`);
          return null as ResponseData;
        } else {
          const data = yield* call(() =>
            client<ResponseData>(query, parameters)
          );

          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
          if (data?.rateLimit) {
            console.info(
              // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
              `GitHub API Query ${chalk.green("cost", data.rateLimit.cost)} and remaining ${chalk.green(data.rateLimit.remaining)}`,
            );
          }

          yield* cache.write(key, data);
          return data;
        }
      };
    }),
  );
}

export function* useGraphQL(): Operation<GraphQLQueryFunction> {
  return yield* GraphQLContext;
}
