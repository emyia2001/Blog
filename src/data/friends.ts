export interface FriendLink {
  /** 站点名 */
  name: string;
  /** 完整 URL（https） */
  url: string;
  /** 一句话简介，可留空 */
  desc?: string;
  /** 头像外链，可留空（空则用名称首字回退） */
  avatar?: string;
}

/**
 * 友链列表：在这里加一项，就会出现在 /friends/ 页面。
 * 顺序即展示顺序。
 */
export const FRIENDS: FriendLink[] = [
  // {
  //   name: "示例博客",
  //   url: "https://example.com/",
  //   desc: "一句话介绍这个站",
  //   avatar: "https://example.com/avatar.png",
  // },
];
