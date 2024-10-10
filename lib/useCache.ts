import {
  call,
  type Channel,
  createChannel,
  createContext,
  each,
  type Operation,
  resource,
  spawn,
  type Stream,
  stream,
  subscribe,
} from "npm:effection@3.0.3";
import { ensureFile, exists, walk, walkSync } from "jsr:@std/fs@1.0.4";
import { JSONLinesParseStream } from "https://deno.land/x/jsonlines@v1.2.1/mod.ts";
import { minimatch } from "npm:minimatch@10.0.1";
import { basename, dirname, globToRegExp, join } from "jsr:@std/path@1.0.6";

interface Cache {
  location: URL;
  write(key: string, data: unknown): Operation<void>;
  read<T>(key: string): Operation<Stream<T, unknown>>;
  has(key: string): Operation<boolean>;
  find<T>(directory: string): Operation<Stream<T, unknown>>;
}

export const CacheContext = createContext<Cache>("cache");

interface InitCacheContextOptions {
  location: URL;
}

export function* initCacheContext(options: InitCacheContextOptions) {
  const cache: Cache = {
    location: options.location,
    *write(key, data): Operation<void> {
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
    },
    *read<T>(key: string) {
      const location = new URL(`./${key}.jsonl`, options.location);
      const file = yield* call(() => Deno.open(location, { read: true }));

      const lines = file
        .readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JSONLinesParseStream());

      return stream(lines as ReadableStream<T>);
    },
    *has(key) {
      const location = new URL(`./${key}.jsonl`, options.location);

      return yield* call(() => exists(location));
    },
    *find<T>(glob: string): Operation<Channel<T, void>> {
      const channel = createChannel<T, void>();

      const iterable = walkSync(options.location, {
        includeDirs: false,
        includeFiles: true,
        match: [
          globToRegExp(`${options.location.pathname}/${glob}`, {
            globstar: true,
          }),
        ],
      });

      let next = iterable.next();
      while (!next.done) {
        next = iterable.next();
      }
      console.log("Finished")

      yield* spawn(function* () {
        for (
          const file of walkSync(options.location, {
            includeDirs: false,
            includeFiles: true,
            match: [
              globToRegExp(`${options.location.pathname}/${glob}`, {
                globstar: true,
              }),
            ],
          })
        ) {
          // const key = join(
          //   dirname(file.path.replace(options.location.pathname, "")),
          //   basename(file.name, ".jsonl"),
          // );
          // const items = yield* cache.read<T>(key);
          // for (const item of yield* each(items)) {
          //   console.log("before send", item);
          //   yield* channel.send(item);
          //   yield* each.next();
          // }
          channel.send(file)
          console.log("value sent")
          // console.log(file);
        }
        console.log("finished loop")
        yield* channel.close();
      });

      return channel;
    },
  };

  return yield* CacheContext.set(cache);
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext;
}
