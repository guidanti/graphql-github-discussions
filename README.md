## Approach

| Key |
| :-- |
| 🟢 = queries |
| 🔴 = loops |

```
.
  ├── 🟢 get x number of discussions
  | └── 🔴 for each discussion
  |   ├── more than 100 comments in discussion?
  |   | └── 🟢🔴 get remaining comments for discussion
  |   ├── group comments into batches
  |   ├── 🔴 for each group
  |   | └── 🟢 get replies for all comments (BULK)
  |   |   └── 🔴 for each comment
  |   |     ├── more than 100 replies in comment?
  |   |     | └── 🟢🔴 get remaining replies for comment
  |   |     └──  push replies to comment
  |   └── return discussion
  └── more than 100 discussions? loop from the start
```

## TODOs

- [ ] Efficient bulking (see section below)
- [ ] Refactor using Effection and add incremental backoff

## Efficient Bulking

The workflow outlined above would work well if there are fewer discussions with high number of comments:

```json
{
  "discussions": [
    {
      "id": 1,
      "comments": 1000,
    },
    {
      "id": 2,
      "comments": 1000,
    }
  ]
}
```

The data above would require approximately 21 queries.

However, if we have a high number of discussions with few comments:

```json
{
  "discussion": [
    {
      "id": 1,
      "comments": 1,
    },
    {
      "id": 2,
      "comments": 1,
    },
    ... 1000 more discussions
  ]
}
```

This would require approximately 1011 queries.

To anticipate the second scenario, we would need to batch the comments at a level higher so that we can group the comments across multiple discussions:

```diff
.
  ├── 🟢 get x number of discussions
  | └── 🔴 for each discussion
  | | ├── more than 100 comments in discussion?
  | | | └── 🟢🔴 get remaining comments for discussion
- | | ├── group comments into batches
  | | └── return discussion
+ | └── take every comment of all 100 discussions and group them into batches
  |   └── 🔴 for each group
  |     └── 🟢 get replies for all comments (BULK)
  |       └── 🔴 for each comment
  |         ├── more than 100 replies in comment?
  |         | └── 🟢🔴 get remaining replies for comment
  |         └──  push replies to comment of the correct discussion
  └── more than 100 discussions? loop from the start
```

> We're testing with [next.js](https://github.com/vercel/next.js/discussions?discussions_q=) which has ~22,000 discussions. From a sample data of 1300 discussions, the average comment count was 8. So that should bring us to around 1,760 points for each ingestion.
