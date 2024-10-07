import { createContext, call, type Operation } from "npm:effection@3.0.3";
import { ensureDir } from "jsr:@std/fs@1.0.4";
import { type JsonWriter, useJsonWriter } from "./useJsonWriter.ts";

interface Cache {
  discussions: {
    location: URL;
    write: JsonWriter;
  };
  comments: {
    location: URL;
    write: JsonWriter;
  }
}

export const CacheContext = createContext<Cache>("cache");

export function* initCacheContext({ location }: { location: URL }) {
  yield* call(() => ensureDir(location));
  const discussionPath = new URL(".cache/discussion.jsonl", location);
  const commentsPath = new URL(".cache/comments.jsonl", location);

  return yield* CacheContext.set({
    discussions: {
      location: discussionPath,
      write: yield* useJsonWriter(discussionPath)
    },
    comments: {
      location: commentsPath,
      write: yield* useJsonWriter(commentsPath)
    }
  })
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext;
}