import friendsData from "./friends.json";

export interface FriendLink {
  /** 站点名 */
  name: string;
  /** 完整 URL（https） */
  url: string;
  /** 一句话简介，可留空 */
  desc?: string;
  /** 头像外链，可留空（空则用名称首字回退） */
  avatar?: string;
  /** 双向友链：对方也链接了本站。不填或 false = 单向友链（本站单向推荐） */
  mutual?: boolean;
  /** RSS/Atom feed 地址，可留空。
   *  留空时构建期会自动探测（先抓主页的 <link rel="alternate">，再试常见路径），
   *  但建议显式写上——省请求且不受对方主页改版影响。 */
  rss?: string;
}

/**
 * 友链列表：数据在 friends.json，在这里加一项（或用 Obsidian 的 Snark Blog CMS 插件编辑），
 * 就会出现在 /friends/ 页面；mutual: true 的排进「双向友链」，其余排进「单向友链」。
 * 顺序即组内展示顺序。
 */
export const FRIENDS: FriendLink[] = friendsData;
