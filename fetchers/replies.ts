import { call, each, type Operation } from "npm:effection@3.0.3";
import { useGraphQL } from "../lib/useGraphQL.ts";
import { useCache } from "../lib/useCache.ts";
import { useEntries } from "../lib/useEntries.ts";
import { chunk } from "jsr:@std/collections@1.0.7";
import { Comment } from "../types.ts";
import { CommentCursor } from "./discussion.ts";
import chalk from "npm:chalk@5.3.0";

export function* fetchReplies({
  first = 50,
  batch = 2,
}: {
  first?: number;
  batch?: number;
} = {}): Operation<void> {
  const cache = yield* useCache();

  let subscription = yield* cache.find<Comment>("discussions/*/*");

  let next = yield* subscription.next();
  while (!next.done) {
    console.dir(next, { depth: 2 });
    next = yield* subscription.next();
  }
  // for (const result of yield* each(cache.find<Comment>("discussions/*/*"))) {
  //   yield* call(() => {
  //     console.log("loggint out results")
  //     console.log(result)
  //   });
  //   yield* each.next();
  // }
  // console.log("done with the operatin");
}

interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
} // 🚨

type BatchQuery = {
  [key: string]: {
    id: string;
    replies: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: {
        id: string;
        bodyText: string;
        author: {
          login: string;
        };
        discussion: {
          number: number;
        };
      }[];
    };
  };
} & RateLimit; // 🚨
