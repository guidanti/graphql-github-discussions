import { useCache } from "./lib/useCache.ts";

/*
.
└── .cache
    └── discussions
      ├── 111
      |  ├── 111-aaa
      |  |  ├── 111-aaa-reply-1.jsonl
      |  |  └── 111-aaa-reply-2.jsonl
      |  |── 222-bbb
      |  |  └── 222-aaa-reply-1.jsonl
      |  ├── 111-aaa.jsonl
      |  └── 111-bbb.jsonl
      ├── 222
      |  |── 222-aaa
      |  |  ├── 222-aaa-reply-1.jsonl
      |  |  └── 222-aaa-reply-2.jsonl
      |  |── 222-bbb
      |  |  └── 222-aaa-reply-1.jsonl
      |  ├── 222-aaa.jsonl
      |  └── 222-bbb.jsonl
      ├── 111.jsonl
      └── 222.jsonl
*/

export function* stitch() {
  const cache = yield* useCache();
  for (const discussion of yield* cache.find("discussions/*")) {
    const comments = [];
    for (const comment of yield* cache.find("discussions/*/*")) {
      const replies = [];
      for (const reply of yield* cache.find(`discussions/*/${comment.id}/*`)) {
        replies.push(reply);
      }
      comments.push({
        ...comment,
        replies,
      })
    }
    yield* {
      ...discussion,
      comments,
    }
  }
}
