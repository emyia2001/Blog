export interface FriendLink {
  /** 站点名 */
  name: string;
  /** 完整 URL（https） */
  url: string;
  /** 一句话简介，可留空 */
  desc?: string;
  /** 头像外链，可留空（空则用名称首字回退） */
  avatar?: string;
  /** RSS/Atom feed 地址，可留空。
   *  留空时构建期会自动探测（先抓主页的 <link rel="alternate">，再试常见路径），
   *  但建议显式写上——省请求且不受对方主页改版影响。
   *  feed 可达时，最新几篇文章会以「友链文章」节点出现在归档页关系图谱里。 */
  rss?: string;
}

/**
 * 友链列表：在这里加一项，就会出现在 /friends/ 页面；
 * 填了 rss 的还会进归档页关系图谱（构建期抓 feed，每日定时构建自动刷新）。
 * 顺序即展示顺序。
 */
export const FRIENDS: FriendLink[] = [
  {
    name: "MmzMing的博客",
    url: "https://tblog.mmzhiku.xyz/",
    desc: "Java 后端与 AI 工程实践",
    avatar: "https://tblog.mmzhiku.xyz/assets/images/aut.jpg",
    rss: "https://tblog.mmzhiku.xyz/rss.xml",
  },
  {
    name: "花墨",
    url: "https://flowersink.com/",
    desc: "再花的个人博客：生活随笔、书影音与折腾记录",
    avatar: "https://api.flowersink.com/img/logo.png",
    rss: "https://flowersink.com/rss.xml",
  },
];
