```
[discussion]<-[comment]->[replies]

1st pass: [discussion]<-[comment] => comment_ids
2nd pass: fetch next set of pages for comments of discussions
  -> repeat until finished
3nd pass: batch fetch replies using comment_ids
```

> We're testing with [next.js](https://github.com/vercel/next.js/discussions?discussions_q=) which has ~22,000 discussions. From a sample data of 1300 discussions, the average comment count was 8. So that should bring us to around _1,760_ points for each ingestion if we batch query 100 comments, _3,740_ points if we batch query 50 comments.
