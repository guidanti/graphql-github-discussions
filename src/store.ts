class Discussion {
  constructor(public id: string, public number: number,  public comments: Map<string, Comment> = new Map()) {}
}

class Comment {
  constructor(public id: string, public replies: Map<string, Reply> = new Map()) {}
}

class Reply {
  constructor(public id: string) {

  }
}

class Store {
  private discussions: Map<string, Discussion>
  private comments: Map<string, Comment>
  private replies: Map<string, Replies>

  constructor() {
    this.discussions = new Map();
    this.comments = new Map();
    this.replies = new Map();
  }
  
}