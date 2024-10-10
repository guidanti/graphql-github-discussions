import {
  call,
  createContext,
  createQueue,
  each,
  type Operation,
  spawn,
  type Stream,
  stream,
} from "npm:effection@3.0.3";
import { ensureFile, exists, walkSync } from "jsr:@std/fs@1.0.4";
import { JSONLinesParseStream } from "https://deno.land/x/jsonlines@v1.2.1/mod.ts";
import { basename, dirname, globToRegExp, join } from "jsr:@std/path@1.0.6";

interface Cache {
  location: URL;
  write(key: string, data: unknown): Operation<void>;
  read<T>(key: string): Operation<Stream<T, unknown>>;
  has(key: string): Operation<boolean>;
  find<T>(directory: string): Stream<T, unknown>;
}

export const CacheContext = createContext<Cache>("cache");

interface InitCacheContextOptions {
  location: URL;
}

export function* initCacheContext(options: InitCacheContextOptions) {
  const cache: Cache = createCache(options);

  return yield* CacheContext.set(cache);
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext;
}

function createCache(options: InitCacheContextOptions): Cache {
  function* has(key: string) {
    const location = new URL(`./${key}.jsonl`, options.location);

    return yield* call(() => exists(location));
  }

  function* read<T>(key: string) {
    const location = new URL(`./${key}.jsonl`, options.location);
    const file = yield* call(() => Deno.open(location, { read: true }));

    const lines = file
      .readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new JSONLinesParseStream());

    return stream(lines as ReadableStream<T>);
  }

  function* write(key: string, data: unknown): Operation<void> {
    const location = new URL(`./${key}.jsonl`, options.location);
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
  }

  function* find<T>(glob: string): Stream<T, void> {
    const queue = createQueue<T, void>();

    
    const reg = globToRegExp(`${options.location.pathname}/${glob}`, {
      globstar: true,
    });

    const files = walkSync(options.location, {
      includeDirs: false,
      includeFiles: true,
      match: [
        reg,
      ],
    });

    yield* spawn(function* () {
      for (const file of files) {
        const key = join(
          dirname(file.path.replace(options.location.pathname, "")),
          basename(file.name, ".jsonl"),
        );
        const items = yield* read<T>(key);
        for (const item of yield* each(items)) {
          console.log("before send", item);
          yield* each.next();
          queue.add(item);
        }
      }

      queue.close();
    });

    return queue;
  }

  return {
    location: options.location,
    write,
    read,
    has,
    find,
  };
}
