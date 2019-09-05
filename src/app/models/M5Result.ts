export interface M5ResultHeader {
  code: number;
  message: string;
}


export class M5Result {
  header: M5ResultHeader;
}

export class M5ResultMember extends M5Result {
  header: M5ResultHeader;
  member: object;
}

export class M5ResultPosts extends M5Result {
  header: M5ResultHeader;
  posts: object;
}
//kimcy
export class M5ResultToken extends M5Result {
  header: M5ResultHeader;
  body: object;
}
