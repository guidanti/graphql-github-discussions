import { ensureDir } from "jsr:@std/fs@1.0.4";
import { join } from "jsr:@std/path@1.0.6";
import { parse } from "npm:graphql@16.9.0";
import * as typescriptPlugin from "npm:@graphql-codegen/typescript@4.1.0";
import * as typescriptOperationsPlugin from "npm:@graphql-codegen/typescript-operations@4.3.0";
import { codegen } from "npm:@graphql-codegen/core@4.0.2";
import { loadDocuments } from "npm:@graphql-tools/load@8.0.3";
import { CodeFileLoader } from "npm:@graphql-tools/code-file-loader@8.1.4";

const { schema } = await import("npm:@octokit/graphql-schema@15.25.0");

const __generated__ = join(Deno.cwd(), "./__generated__");

const output = await codegen({
  documents: await loadDocuments(join(Deno.cwd(), "./fetchers/*.ts"), {
    loaders: [new CodeFileLoader()],
  }),
  filename: __generated__,
  schema: parse(schema.idl),
  config: {},
  plugins: [
    {
      typescript: {
        avoidOptionals: true,
      },
      typescriptOperations: {},
    },
  ],
  pluginMap: {
    typescript: typescriptPlugin,
    typescriptOperations: typescriptOperationsPlugin,
  },
});

console.log(output)

await ensureDir(__generated__);

await Deno.writeTextFile(join(__generated__, "types.ts"), output);

console.log(`Generated ${__generated__}`);
