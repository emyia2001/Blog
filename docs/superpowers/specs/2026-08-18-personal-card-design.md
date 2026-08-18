# 个人名片设计文档

## 项目概述

为 Astro 博客添加一个杂志风格的个人名片组件，放置在首页侧边栏，展示作者信息和社交链接。

### 目标

1. **视觉一致性** - 符合当前博客的杂志风格设计
2. **信息完整性** - 展示头像、名称、简介和社交链接
3. **交互体验** - 添加微妙的 hover 动画效果

## 设计方案

### 方案 C：极简风格（用户选择）

**布局**: 水平布局的头像和名称，简洁的图标式社交链接

**颜色方案**: 暖色调
- 背景: `#F9F8F6`（米白色）
- 文字: `#1C1C1C`（深灰色）
- 辅助文字: `#86868b`（中灰色）
- 边框: 无边框，使用阴影区分

**头像样式**: 方形圆角
- 尺寸: 50px × 50px
- 圆角: 8px
- 背景: 深灰色渐变

**社交链接样式**: 图标式
- 尺寸: 24px × 24px
- 圆角: 4px
- 背景: 深灰色
- 图标: 白色

**动画效果**: 轻微上浮
- 鼠标悬停时卡片上浮 2px
- 添加微妙的阴影效果
- 过渡时间: 0.2s

## 组件结构

```
PersonalCard.astro
├── 头像区域
│   ├── 方形圆角头像
│   └── 作者名称
├── 简介区域
│   └── 个人简介文字
└── 社交链接区域
    ├── GitHub 图标
    ├── 微信图标
    └── 网易云图标
```

## 数据结构

```typescript
interface PersonalCardProps {
  name: string;
  bio: string;
  avatar: string;
  socialLinks: {
    github?: string;
    wechat?: string;
    netease?: string;
  };
}
```

## 样式设计

### 卡片容器
```css
.personal-card {
  background: #F9F8F6;
  padding: 1.5rem;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.personal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

### 头像
```css
.avatar {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1C1C1C 0%, #2C2C2C 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 社交链接图标
```css
.social-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #1C1C1C;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.social-icon:hover {
  background: #2C2C2C;
}
```

## 集成方式

### 首页侧边栏
在 `src/pages/index.astro` 中添加侧边栏组件：

```astro
<aside class="hidden lg:block w-64 shrink-0">
  <PersonalCard
    name="SNARK"
    bio="随笔 · 技术 · 生活"
    avatar="/images/avatar.jpg"
    socialLinks={{
      github: "https://github.com/emyia2001",
      wechat: "wechat",
      netease: "netease"
    }}
  />
</aside>
```

### 响应式设计
- 桌面端: 显示侧边栏
- 移动端: 隐藏侧边栏（或显示为顶部卡片）

## 错误处理

1. **头像加载失败** - 显示默认字母头像
2. **社交链接无效** - 链接不可点击
3. **响应式布局** - 移动端隐藏或调整布局

## 测试

1. **视觉测试** - 检查各设备下的显示效果
2. **交互测试** - 验证 hover 动画正常
3. **响应式测试** - 移动端和桌面端的布局适配
4. **可访问性测试** - 确保屏幕阅读器可以正确读取

## 实现步骤

1. 创建 `PersonalCard.astro` 组件
2. 添加组件样式
3. 在首页集成侧边栏
4. 添加响应式设计
5. 测试和调优
