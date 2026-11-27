export const SITE_NAME = "Snark";
export const SITE_DESCRIPTION =
  "个人博客 — 关于写作、技术，以及那些缝隙之间的随笔与反思。";

// 关于页头像：同时用于「个人信息卡」和「关系图谱」的中心节点（self）。
// 放到 public/images/ 下，支持 svg / png / webp 等任意浏览器可解码格式；留空则不显示头像。
export const SITE_AVATAR = "/images/touxiang.webp";
export const SITE_URL = "https://snarkm.com";

// 创站日：水印数字（坚持天数）以此为起点
// 暂取第一篇《回来了》的日期，可自行修改
export const SITE_CREATED = new Date("2026-08-06T00:00:00+08:00");

// 关于页「自述」：2–4 行，写你自己（写作动机、技术偏好、日常……）。
// 换行保留（pre-line 渲染）；留空则关于视图不显示自述区。
export const SITE_STORY = `一个普通的咸鱼，创建这个博客的主要目的是记录一下自己
    热爱折腾一些电子产品。喜欢前沿最新技术
    `;

// 车票封面存根的天气回退城市：生产环境优先用 /api/geo 按访客 IP 定位
// （Cloudflare request.cf），本地 dev/preview 无 Worker 时回退到这里。
export const WEATHER_FALLBACK = { city: "北京", lat: 39.9, lon: 116.4 };

// Default background music for pages without a per-post bgm (timeline etc.)
// export const SITE_BGM = {
//   src: "",
//   title: "",
// };

// 个人名片（关于页）中的社交链接。新增平台只需在此加一项：
// - label：无障碍标签 / 悬停提示
// - href：链接地址（站内或外链；留 "#" 表示暂未填写）
// - icon：astro-icon 名称，可在 https://icones.js.org/ 查找，
//   本仓库已装 @iconify-json/mdi，常用如 mdi:github / mdi:twitter / mdi:email / mdi:link 等。
export const SITE_SOCIAL: { label: string; href: string; icon: string }[] = [
  { label: "GitHub", href: "https://github.com/emyia2001", icon: "mdi:github" },
  { label: "微信", href: "https://img.snarkm.com/photo/IMG_6069(20240727-200947).969n7rex9h.JPG", icon: "mdi:wechat" },
];

// 用于「关于」页构建时拉取提交数的 GitHub 仓库（owner/repo）
export const GITHUB_REPO = "emyia2001/Blog";

// Giscus 评论所挂的 GitHub 仓库（与博客源码仓库分开）。换仓库时要同步更新
// repo-id / category / category-id，见 src/components/Giscus.astro。
export const GISCUS_REPO = "emyia2001/comment";
export const GISCUS_REPO_ID = "R_kgDOT0CTSw";
export const GISCUS_CATEGORY = "Announcements";
export const GISCUS_CATEGORY_ID = "DIC_kwDOT0CTS84DDDuA";
