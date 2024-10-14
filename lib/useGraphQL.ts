import {
  call,
  createContext,
  each,
  type Operation,
  useAbortSignal,
} from "npm:effection@3.0.3";
import { RequestParameters } from "npm:@octokit/types@13.6.1";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";
import chalk from "npm:chalk@5.3.0";
import { getOperationName } from "npm:@apollo/client/utilities/index.js";
import { parse } from "npm:graphql@16.8.2";
import { type GraphQlQueryResponse } from "npm:@octokit/graphql@^4.8.0/dist-types/types.ts";
import { useRetryWithBackoff } from './useRetryWithBackoff.ts';

import { assert } from "jsr:@std/assert@1.0.3";
import { initCacheContext, useCache } from "./useCache.ts";
import { useLogger } from "./useLogger.ts";
import { useCost } from "./useCost.ts";

type GraphQLQueryFunction = <ResponseData>(
  query: string,
  parameters?: RequestParameters,
) => Operation<ResponseData>;

export const GraphQLContext = createContext<GraphQLQueryFunction>("graphql");

export function* initGraphQLContext(): Operation<GraphQLQueryFunction> {
  const token = Deno.env.get("GITHUB_TOKEN");
  const logger = yield* useLogger();
  const cost = yield* useCost();

  assert(
    token,
    "You need to have GITHUB_TOKEN configured in our local environment",
  );

  return yield* GraphQLContext.set(
    yield* call(function* () {
      const currentCache = yield* useCache();

      const cache = yield* initCacheContext({
        location: new URL("./github/", currentCache.location),
      });

      return function* query<ResponseData>(
        query: string,
        parameters: RequestParameters = {},
      ): Operation<ResponseData> {
        const operationName = getOperationName(parse(query));
        const key = `${encodeHex(md5(query))}-${
          Object.keys(parameters).map((p) => `${p}:${parameters[p]}`).join("-")
        }`;

        if (yield* cache.has(key)) {
          for (
            const data of yield* each(yield* cache.read<ResponseData>(key))
          ) {
            return data;
          }
          logger.error(`This could happen if cached document had no records.`);
          return null as ResponseData;
        } else {
          let data: ResponseData | undefined
          
          yield* useRetryWithBackoff(function*() {
            data = yield* fetchGitHubGraphQL<ResponseData>({
              token,
              query,
              variables: parameters
            })
          }, {
            operationName,
          });
          
          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
          if (data?.rateLimit) {
            logger.info(
              `GitHub API Query ${operationName} with ${JSON
                  .stringify(parameters)
                // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
              } ${chalk.green("cost", data.rateLimit.cost)} and remaining ${
                // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
                chalk.green(data.rateLimit.remaining)}`,
            );
            cost.update({
              // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
              cost: data.rateLimit.cost,
              // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
              nodeCount: data.rateLimit.nodeCount,
              // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.deno-ts(2339)
              remaining: data.rateLimit.remaining,
            });
          }

          assert(data, "Could not fetch data from GraphQL API")

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

function* fetchGitHubGraphQL<ResponseData>(
  { token, query, variables }: {
    token: string;
    query: string;
    variables: { [key: string]: unknown };
  },
) {
  const logger = yield* useLogger();
  const signal = yield* useAbortSignal();
  const response = yield* call(() =>
    fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: new Headers({
        Authorization: `token ${token}`,
        "X-Github-Next-Global-ID": "1",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        query,
        variables,
      }),
      signal,
    })
  );
  if (response.ok) {
    const payload = yield* call<GraphQlQueryResponse<ResponseData>>(() =>
      response.json()
    );
    if (payload.errors) {
      for (const error of payload.errors ?? []) {
        logger.error(
          `${getOperationName(parse(query))} with ${
            JSON.stringify(variables)
          } encountered an error ${JSON.stringify(error)}`,
        );
      }
    }
    return payload.data;
  } else {
    throw new Error(`${response.status} ${response.statusText}`)
  }
}
