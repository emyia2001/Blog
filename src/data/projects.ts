// 项目票夹数据（参考 darciw.me 的 Project Wallet）
export interface Project {
  slug: string          // 项目唯一标识
  no: string           // 编号（PRJ/01）
  name: string         // 项目名称
  sub: string          // 副标题描述
  brief: string        // 详细简介
  status: string       // 当前状态（如「MVP 框架」）
  date: string         // 日期（如「2026.08」）
  focus: string        // 关注点
  stage: 0 | 1 | 2 | 3 // 阶段进度（0=概念, 1=框架, 2=MVP, 3=上线）
  stack: string[]      // 技术栈/标签
  points: string[]     // 核心要点（最多3条）
  link?: string        // 可选：项目链接
}

export const PROJECTS: Project[] = [
  {
    slug: 'snark-blog',
    no: '01',
    name: 'Snark 博客',
    sub: '一个基于 Astro 5 的个人博客，期刊排版风格，纯静态生成。',
    brief: '一个用 Astro 5 + MDX + Tailwind CSS v4 搭建的个人博客系统，支持文章、纪事、关系图谱、全文搜索。',
    status: '持续迭代',
    date: '2024.11',
    focus: '排版美学',
    stage: 3,
    stack: ['Astro 5', 'MDX', 'Tailwind v4', 'Pagefind', 'D3-force'],
    points: [
      '期刊编辑风设计语言',
      '文章与纪事双内容模型',
      '关系图谱可视化交互'
    ],
    link: 'https://snarkm.com'
  },
  // 可以继续添加更多项目...
]

// 阶段名称映射
export const STAGE_NAMES = ['概念', '框架', 'MVP', '上线'] as const
export const STAGE_STATUS = ['完成', '完成', '进行中', '未开始'] as const
