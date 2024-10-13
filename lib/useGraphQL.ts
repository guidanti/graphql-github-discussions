import {
  call,
  createContext,
  each,
  type Operation,
  useAbortSignal,
} from "npm:effection@3.0.3";
import { graphql } from "npm:@octokit/graphql@4.8.0";
import { RequestParameters } from "npm:@octokit/types@13.6.1";
import { md5 } from "jsr:@takker/md5@0.1.0";
import { encodeHex } from "jsr:@std/encoding@1";
import chalk from "npm:chalk@5.3.0";
import { getOperationName } from "npm:@apollo/client/utilities/index.js";
import { parse } from "npm:graphql@16.8.2";

import { assert } from "jsr:@std/assert@1.0.3";
import { initCacheContext, useCache } from "./useCache.ts";
import { useLogger } from "./useLogger.ts";
import { GraphqlResponseError } from "npm:@octokit/graphql@^4.8.0";
import pRetry from "npm:p-retry@6.2.0";
import { delay } from "npm:abort-controller-x@0.4.3";
import { isErrorResponse } from "jsr:@udibo/http-error@0.8.2";

type GraphQLQueryFunction = <ResponseData>(
  query: string,
  parameters?: RequestParameters,
) => Operation<ResponseData>;

export const GraphQLContext = createContext<GraphQLQueryFunction>("graphql");

export function* initGraphQLContext(): Operation<GraphQLQueryFunction> {
  const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
  const logger = yield* useLogger();

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
          logger.error(`This could happen if cached document had no records.`);
          return null as ResponseData;
        } else {
          const signal = yield* useAbortSignal();
          let data = yield* call(() =>
            pRetry(() =>
              client<ResponseData>(query, parameters).catch((e) => {
                if (isGraphqlResponseError<ResponseData>(e)) {
                  for (const error of e.errors ?? []) {
                    logger.error(
                      `${getOperationName(parse(query))} with ${
                        JSON.stringify(parameters)
                      } encountered an error ${JSON.stringify(error)}`,
                    );
                  }
                  return e.data;
                }
                throw e
              }), {
              signal,
              onFailedAttempt: async (e: any) => {
                if (isErrorResponse(e)) {
                  if (
                    e.error.name?.includes(
                      "You have exceeded a secondary rate limit.",
                    )
                  ) {
                    logger.log(
                      `Encountered secondary rate limit, waiting two minutes.`,
                    );
                    await delay(signal, 2000);
                    logger.log(`Resuming attempts to fetch data`);
                  }
                }
                logger.log(`Encountered error and will retry ${e}`);
              },
            })
          );

          // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
          if (data?.rateLimit) {
            logger.info(
              `GitHub API Query ${getOperationName(parse(query))} with ${JSON
                  .stringify(parameters)
                // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
              } ${chalk.green("cost", data.rateLimit.cost)} and remaining ${
                // @ts-expect-error Property 'rateLimit' does not exist on type 'NonNullable<ResponseData>'.
                chalk.green(data.rateLimit.remaining)}`,
            );
          }

          assert(data, `Could not fetch data from GitHub API`);

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

function isGraphqlResponseError<ResponseData>(
  error: any,
): error is GraphqlResponseError<ResponseData> {
  return error.name === "GraphqlResponseError";
}
