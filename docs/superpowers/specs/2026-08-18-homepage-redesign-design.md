# 首页改版设计文档

## 项目概述

优化 Astro 博客首页的视觉层次、信息密度和首屏吸引力，重点改进刊首插图区域的动态效果和封面图自动轮换功能。

### 目标

1. **视觉层次强化** - 增加动态微交互、强化视觉层次、引入色彩与质感
2. **封面图自动轮换** - 支持文章封面和固定图片的自动轮换
3. **信息密度优化** - 精简目录展示，优化标签云

## 架构设计

### 组件结构

```
首页 (index.astro)
├── BannerPlate (刊首插图) ← 主要修改
│   ├── 动态线条背景
│   ├── 封面图轮播
│   └── 网站简介
├── CoverPlate (本期封面)
├── 目录列表
├── Moments (浮光)
└── 标签云
```

### 数据流

1. 首页从 `posts` 集合获取所有已发布文章
2. 提取带 `heroImage` 的文章作为轮播素材
3. 不足时从 `public/images/banner/` 目录补充固定图片
4. BannerPlate 组件接收图片列表进行自动轮播

## 组件设计

### BannerPlate 组件

**Props:**
```typescript
interface Props {
  variant?: number;      // 线条构图类型 (0/1/2)
  days?: string;         // 创站天数
  number?: string;       // 期号
  intro?: string[];      // 网站简介
  slides?: Slide[];      // 轮播图片列表
}

interface Slide {
  image: string;         // 图片路径
  title?: string;        // 可选标题
  link?: string;         // 可选链接
}
```

**功能:**

1. **动态线条背景**
   - 添加 CSS 动画，让线条缓慢上下漂移
   - 使用 `@keyframes` 实现漂移效果

2. **封面图轮播**
   - 5秒自动切换
   - 淡入淡出过渡效果 (opacity transition)
   - 鼠标悬停时暂停
   - 优先使用文章封面，不足时用固定图片补充

3. **视觉层次增强**
   - 右侧简介区域增加卡片阴影
   - 主标语添加打字机效果
   - 背景添加微妙的纸张纹理

### 样式设计

**线条动画:**
```css
@keyframes line-drift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.wave-drift path {
  animation: line-drift 8s ease-in-out infinite;
}
```

**轮播效果:**
```css
.banner-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.8s ease-in-out;
}

.banner-slide.active {
  opacity: 1;
}
```

**卡片阴影:**
```css
.intro-card {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.intro-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
```

## 信息密度优化

### 目录展示

**当前:** 显示所有文章
**优化后:** 
- 默认显示前 3 篇
- 点击"展开全部"显示剩余文章
- 使用 `details/summary` 或 JS 控制展开

### 标签云

**当前:** 逐个列出标签及其文章
**优化后:**
- 横排标签云布局
- 按文章数调整字体大小和颜色深浅
- 点击进入标签页查看文章列表

## 错误处理

1. **图片加载失败** - 显示占位图或渐变背景
2. **轮播数据为空** - 回退到纯线条背景
3. **动画性能** - 使用 `will-change` 和 `transform` 优化

## 测试

1. **视觉测试** - 检查各设备下的显示效果
2. **性能测试** - 确保动画流畅，无卡顿
3. **交互测试** - 验证悬停暂停功能正常
4. **响应式测试** - 移动端和桌面端的布局适配

## 实现步骤

1. 创建轮播图片数据结构
2. 修改 BannerPlate 组件支持轮播
3. 添加线条漂移动画
4. 实现卡片阴影和打字机效果
5. 优化目录展示（展开/收起）
6. 改造标签云布局
7. 测试和调优
