import { resource, call, type Operation } from "npm:effection@3.0.3";
import { JSONLinesStringifyStream } from "https://deno.land/x/jsonlines@v1.2.1/mod.ts";

interface JsonLinesFile {
  write(data: unknown): Operation<void>;
}

export function useSerializeJsonLines(destination: string | URL) {
  return resource<JsonLinesFile>(function* (provide) {
    const file = yield* call(() =>
      Deno.open(destination, {
        create: true,
        write: true,
      })
    );

    const jsonLinesFiles: JsonLinesFile = {
      *write(data: unknown): Operation<void> {
        yield* call(() =>
          ReadableStream.from([data])
            .pipeThrough(new JSONLinesStringifyStream())
            .pipeThrough(new TextEncoderStream())
            .pipeTo(file.writable, { preventClose: true })
        );
      },
    };

    try {
      yield* provide(jsonLinesFiles);
    } finally {
      file.close();
    }
  });
}
