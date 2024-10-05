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
