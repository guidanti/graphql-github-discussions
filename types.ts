export interface Comment {
  type: "comment";
  id: string;
  bodyText: string;
  author: string;
  discussionNumber: number;
}

export interface Discussion {
  type: "discussion";
  id: string;
  number: number;
  title: string;
  url: string;
  bodyText: string;
  author: string;
  category: string;
}

export interface Reply {
  type: "reply";
  bodyText: string;
  author: string;
  parentCommentId: string;
  discussionNumber: number;
}

/**
 * Start: undefined
 * Middle: string
 * Last: null
 */
export type CURSOR_VALUE = string | null | undefined;

export type DiscussionEntries =
  | Comment
  | Discussion
  | Reply;
