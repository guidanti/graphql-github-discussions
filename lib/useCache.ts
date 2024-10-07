import { createContext, call, type Operation } from "npm:effection@3.0.3";
import { ensureDir } from "jsr:@std/fs@1.0.4";
import { type JsonWriter, useJsonWriter } from "./useJsonWriter.ts";

interface Cache {
  location: URL;
  discussions: CachedModel;
  comments: CachedModel
}

interface CachedModel {
  location: URL
  write: JsonWriter
}

export const CacheContext = createContext<Cache>("cache");

export function* initCacheContext({ location }: { location: URL }) {
  yield* call(() => ensureDir(location));

  const discussionPath = new URL("discussions.jsonl", location);
  const commentsPath = new URL("comments.jsonl", location);

  return yield* CacheContext.set({
    location,
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