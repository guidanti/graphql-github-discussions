import {
  call,
  createContext,
  createQueue,
  type Operation,
  spawn,
  type Stream,
  stream,
} from "npm:effection@3.0.3";
import { ensureFile, exists, walkSync } from "jsr:@std/fs@1.0.4";
import { basename, dirname, globToRegExp, join } from "jsr:@std/path@1.0.6";

import { JSONLinesParseStream } from './jsonlines/parser.ts';

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
  return yield* CacheContext.set(new PersistantCache(options.location));
}

export function* useCache(): Operation<Cache> {
  return yield* CacheContext;
}

class PersistantCache implements Cache {
  constructor(public location: URL) {}

  *has(key: string) {
    const location = new URL(`./${key}.jsonl`, this.location);

    return yield* call(() => exists(location));
  }

  *read<T>(key: string) {
    const location = new URL(`./${key}.jsonl`, this.location);
    const file = yield* call(() => Deno.open(location, { read: true }));

    const lines = file
      .readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new JSONLinesParseStream());

    return stream(lines as ReadableStream<T>);
  }

  *write(key: string, data: unknown) {
    const location = new URL(`./${key}.jsonl`, this.location);
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

  *find<T>(glob: string) {
    const queue = createQueue<T, void>();

    const reg = globToRegExp(`${this.location.pathname}/${glob}`, {
      globstar: true,
    });

    const files = walkSync(this.location, {
      includeDirs: false,
      includeFiles: true,
      match: [
        reg,
      ],
    });

    const { location } = this;
    const read = this.read.bind(this);

    yield* spawn(function* () {
      for (const file of files) {
        const key = join(
          dirname(file.path.replace(location.pathname, "")),
          basename(file.name, ".jsonl"),
        );
        const items = yield* read<T>(key);

        const subscription = yield* items;
        let next = yield* subscription.next();
        while (!next.done) {
          queue.add(next.value);
          next = yield* subscription.next();
        }
      }

      queue.close();
    });

    return queue;
  }
}
