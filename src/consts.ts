export const SITE_NAME = "Snark";
export const SITE_DESCRIPTION =
  "一个个人博客 — 关于写作、技术，以及那些缝隙之间的随笔与反思。";

// 关于页头像：同时用于「个人信息卡」和「关系图谱」的中心节点（self）。
// 放到 public/images/ 下，支持 svg / png / webp 等任意浏览器可解码格式；留空则不显示头像。
export const SITE_AVATAR = "/images/touxiang.webp";
export const SITE_URL = "https://blog.snark.casa";

// 创站日：水印数字（坚持天数）以此为起点
// 暂取第一篇《回来了》的日期，可自行修改
export const SITE_CREATED = new Date("2026-08-06T00:00:00+08:00");

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
  { label: "微信", href: "https://img.snark.casa/photo/IMG_6069(20240727-200947).969n7rex9h.JPG", icon: "mdi:wechat" },
  { label: "网易云音乐", href: "#", icon: "mdi:music-circle" },
];
