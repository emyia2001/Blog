# 个人名片实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加一个杂志风格的个人名片组件到首页侧边栏，展示作者信息和社交链接

**Architecture:** 创建一个独立的 `PersonalCard.astro` 组件，使用 Tailwind CSS 实现暖色调极简设计，放置在首页右侧栏

**Tech Stack:** Astro, Tailwind CSS

---

## 文件结构

- **Create:** `src/components/PersonalCard.astro`
- **Modify:** `src/pages/index.astro:78-89` (添加侧边栏)
- **Modify:** `src/styles/editorial.css` (添加卡片动画样式)

---

### Task 1: 创建 PersonalCard 组件

**Files:**
- Create: `src/components/PersonalCard.astro`

- [ ] **Step 1: 创建组件文件**

```astro
---
interface Props {
  name: string;
  bio: string;
  avatar?: string;
  socialLinks?: {
    github?: string;
    wechat?: string;
    netease?: string;
  };
}

const { name, bio, avatar, socialLinks } = Astro.props;
const initial = name.charAt(0).toUpperCase();
---

<div class="personal-card">
  <div class="flex items-center gap-3 mb-4">
    {avatar ? (
      <img 
        src={avatar} 
        alt={name} 
        class="avatar"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
      />
    ) : null}
    <div 
      class="avatar" 
      style={avatar ? 'display: none' : 'display: flex'}
    >
      <span class="text-lg font-serif text-white">{initial}</span>
    </div>
    <div>
      <h3 class="font-serif text-sm text-[var(--color-ed-fg)] tracking-tight">{name}</h3>
    </div>
  </div>
  
  <p class="text-xs text-[var(--color-ed-muted)] mb-4 leading-relaxed">{bio}</p>
  
  <div class="flex gap-2">
    {socialLinks?.github && (
      <a 
        href={socialLinks.github} 
        target="_blank" 
        rel="noopener noreferrer"
        class="social-icon"
        aria-label="GitHub"
      >
        <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
    )}
    {socialLinks?.wechat && (
      <div class="social-icon" aria-label="微信">
        <span class="text-white text-[8px] font-bold">微</span>
      </div>
    )}
    {socialLinks?.netease && (
      <div class="social-icon" aria-label="网易云音乐">
        <span class="text-white text-[8px] font-bold">云</span>
      </div>
    )}
  </div>
</div>

<style>
  .personal-card {
    background: #F9F8F6;
    padding: 1.25rem;
    border-radius: 8px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .personal-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .avatar {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    background: linear-gradient(135deg, #1C1C1C 0%, #2C2C2C 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .social-icon {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: #1C1C1C;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
    cursor: pointer;
  }

  .social-icon:hover {
    background: #2C2C2C;
  }
</style>
```

- [ ] **Step 2: 验证组件语法**

Run: `npm run build`
Expected: 构建成功，无语法错误

- [ ] **Step 3: Commit**

```bash
git add src/components/PersonalCard.astro
git commit -m "feat: add PersonalCard component"
```

---

### Task 2: 集成到首页侧边栏

**Files:**
- Modify: `src/pages/index.astro:78-89`

- [ ] **Step 1: 添加导入语句**

在 `src/pages/index.astro` 文件顶部的 import 区域（约第 10 行）添加：

```astro
---
import PersonalCard from "../components/PersonalCard.astro";
// ... 其他 imports
---
```

- [ ] **Step 2: 修改首页布局**

将 `src/pages/index.astro:78-89` 的：

```astro
<BaseLayout title="首页">
  <!-- ===== 刊首插图（动态：构图按日期轮换 + 波浪微动效） ===== -->
  <div class="px-6 pt-16 md:pt-24 pb-6">
    <div class="mx-auto max-w-6xl">
      <BannerPlate
  variant={bannerVariant}
  days={daysStr}
  number={vol}
  slides={bannerSlides}
/>
    </div>
  </div>
```

改为：

```astro
<BaseLayout title="首页">
  <div class="px-6 pt-16 md:pt-24 pb-6">
    <div class="mx-auto max-w-6xl flex gap-8">
      <!-- 主内容区 -->
      <div class="flex-1 min-w-0">
        <BannerPlate
          variant={bannerVariant}
          days={daysStr}
          number={vol}
          slides={bannerSlides}
        />
      </div>
      
      <!-- 侧边栏 -->
      <aside class="hidden lg:block w-64 shrink-0">
        <PersonalCard
          name="SNARK"
          bio="随笔 · 技术 · 生活"
          socialLinks={{
            github: "https://github.com/emyia2001",
            wechat: "wechat",
            netease: "netease"
          }}
        />
      </aside>
    </div>
  </div>
```

- [ ] **Step 3: 验证布局**

Run: `npm run build`
Expected: 构建成功，首页显示侧边栏

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: integrate PersonalCard into homepage sidebar"
```

---

### Task 3: 调整响应式布局

**Files:**
- Modify: `src/pages/index.astro:78-100`

- [ ] **Step 1: 修改响应式断点**

将 `src/pages/index.astro` 中的侧边栏部分修改为：

```astro
<!-- 侧边栏 -->
<aside class="hidden lg:block w-64 shrink-0 sticky top-24 self-start">
  <PersonalCard
    name="SNARK"
    bio="随笔 · 技术 · 生活"
    socialLinks={{
      github: "https://github.com/emyia2001",
      wechat: "wechat",
      netease: "netease"
    }}
  />
</aside>
```

- [ ] **Step 2: 验证响应式效果**

Run: `npm run build && npm run preview`
Expected: 
- 桌面端 (lg 以上): 显示侧边栏
- 移动端 (lg 以下): 隐藏侧边栏

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add sticky positioning for sidebar"
```

---

### Task 4: 最终验证

- [ ] **Step 1: 运行完整构建**

Run: `npm run build`
Expected: 构建成功，无错误

- [ ] **Step 2: 检查视觉效果**

Run: `npm run preview`
Expected: 
- 个人名片显示在首页右侧
- 暖色调背景（#F9F8F6）
- 方形圆角头像
- 图标式社交链接
- Hover 时轻微上浮效果

- [ ] **Step 3: 检查响应式**

在浏览器中调整窗口大小：
- 桌面端 (>1024px): 显示侧边栏
- 移动端 (<1024px): 隐藏侧边栏

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete personal card implementation"
```
