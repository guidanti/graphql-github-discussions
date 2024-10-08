import { createContext, call, type Operation, stream, type Stream } from "npm:effection@3.0.3";
import { ensureFile, exists } from "jsr:@std/fs@1.0.4";
import { JSONLinesParseStream } from "https://deno.land/x/jsonlines@v1.2.1/mod.ts";


interface Cache {
  location: URL;
  write(key: string, data: unknown): Operation<void>
  read<T>(key: string): Operation<Stream<T, unknown>>
  has(key: string): Operation<boolean>;
}

export const CacheContext = createContext<Cache>("cache");

interface InitCacheContextOptions { 
  location: URL
}

export function* initCacheContext(options: InitCacheContextOptions) {
  const cache: Cache = {
    location: options.location,
    *write(key, data): Operation<void> {
      const location = new URL(`./${key}.jsonl`, options.location)
      yield* call(() => ensureFile(location));

      const file = yield* call(() =>
        Deno.open(location, {
          append: true,
        })
      );
  
      try {
        yield* call(() =>
          file.write(new TextEncoder().encode(`${JSON.stringify(data)}\n`))
        );
      } finally {
        file.close();
      }
    },
    *read<T>(key: string) {
      const location = new URL(`./${key}.jsonl`, options.location)
      const file = yield* call(() => Deno.open(location, { read: true }));

      const lines = file
          .readable
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new JSONLinesParseStream());
      
      return stream(lines as ReadableStream<T>)
    },
    *has(key) {
      const location = new URL(`./${key}.jsonl`, options.location);

      return yield* call(() => exists(location));
    }
  };

  return yield* CacheContext.set(cache)
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext;
}