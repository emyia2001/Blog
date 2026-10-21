// 让 Astro 生成的内容集合类型（.astro/content.d.ts）先于 astro/client 的兜底声明加载。
//
// 不这么写会踩一个很隐蔽的坑：astro/client.d.ts reference 了 astro/types/content.d.ts，
// 那是「类型尚未生成时」的兜底，里面把 CollectionEntry<C> 声明成 any；而 .astro/content.d.ts
// 用同样的名字声明了真正的类型。两份同名声明同时进 TS 程序 → TS6200 重复定义 →
// 被 skipLibCheck 静默吞掉 → 全站 CollectionEntry / getCollection 退化成 any，
// 所有内容字段都失去类型保护（类型门禁形同虚设）。
// 先 reference 生成文件，生成的声明先注册、胜出，类型才恢复。
/// <reference path="../.astro/content.d.ts" />
/// <reference types="astro/client" />
