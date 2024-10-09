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

export interface DiscussionCursor {
  type: "discussion-cursor";
  totalCount: number;
  after: CURSOR_VALUE;
  first: number;
  hasNextPage: boolean;
  endCursor: CURSOR_VALUE;
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
  | DiscussionCursor;