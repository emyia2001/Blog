# 首页改版实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化首页视觉层次、信息密度和首屏吸引力，重点改进刊首插图区域的动态效果和封面图自动轮换功能

**Architecture:** 修改 BannerPlate 组件支持封面图轮播，添加动态线条动画和视觉层次增强，优化目录和标签云布局

**Tech Stack:** Astro, Tailwind CSS, SVG Animation

---

## 文件结构

```
修改:
- src/components/BannerPlate.astro (主要修改：添加轮播、动画、视觉增强)
- src/pages/index.astro (传递轮播数据、优化目录和标签)
- src/styles/editorial.css (添加动画样式)

创建:
- public/images/banner/ (存放固定轮播图片)
```

---

### Task 1: 创建轮播图片目录和占位图

**Files:**
- Create: `public/images/banner/.gitkeep`

- [ ] **Step 1: 创建轮播图片目录**

```bash
mkdir -p /Users/snark/Astro-blog/public/images/banner
touch /Users/snark/Astro-blog/public/images/banner/.gitkeep
```

- [ ] **Step 2: 提交更改**

```bash
git add public/images/banner/
git commit -m "chore: create banner images directory"
```

---

### Task 2: 修改 BannerPlate 组件支持轮播

**Files:**
- Modify: `src/components/BannerPlate.astro`

- [ ] **Step 1: 更新 Props 接口**

在 `src/components/BannerPlate.astro` 中，替换 Props 接口：

```typescript
---
// 刊首插图：韵律线条构图（按 variant 轮换）+ 波浪微动效 + 封面轮播 + 网站简介
interface Props {
  variant?: number; // 0 波浪 · 1 涟漪 · 2 等高线
  days?: string; // 水印大数字：创站坚持天数
  number?: string; // 小标注：期号
  intro?: string[]; // 简介正文（按行）
  slides?: Array<{
    image: string;
    title?: string;
    link?: string;
  }>;
}

const { variant = 0, days = "01", number = "01", intro, slides = [] } = Astro.props;
const v = ((variant % 3) + 3) % 3;

const NOTES = ["—— 慢慢写。", "—— 一期一文。", "—— 写给多年后的自己。", "—— 记录，然后遗忘。"];
const note = NOTES[Math.floor(Math.random() * NOTES.length)];

const lines = intro ?? [
  "这是一个个人博客，记录随笔、笔记",
  "与生活里那些浮光。写给多年后的自",
  "己，也写给现在的自己。关于写作、",
  "技术，以及缝隙之间的反思。",
];
---
```

- [ ] **Step 2: 添加轮播 HTML 结构**

在 `<figure class="clip-reveal">` 标签后，替换整个组件内容：

```astro
<figure class="clip-reveal">
  <div class="border border-[var(--color-ed-faint)] p-2 md:p-3">
    <div class="flex flex-col md:flex-row items-stretch bg-[#F9F8F6]">
      <!-- 左：韵律线条 + 封面轮播 -->
      <div class="banner-left relative flex-1 min-w-0 aspect-[16/9] md:aspect-auto md:h-[420px] overflow-hidden">
        <!-- 轮播图片层 -->
        {slides.length > 0 && (
          <div class="banner-slides absolute inset-0 z-0">
            {slides.map((slide, i) => (
              <a
                href={slide.link || "#"}
                class={`banner-slide absolute inset-0 transition-opacity duration-800 ${i === 0 ? 'opacity-100' : 'opacity-0'}`}
                data-index={i}
              >
                <img
                  src={slide.image}
                  alt={slide.title || ""}
                  class="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              </a>
            ))}
          </div>
        )}

        <!-- 线条动画层（叠加在轮播上） -->
        <div class="banner-lines absolute inset-0 z-10 pointer-events-none">
          {v === 0 && (
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 2100 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="2100" height="900" fill="transparent"/>
              <g class="wave-drift" fill="none" stroke="#1C1C1C">
                <path d="M 0 620 Q 225 560 450 620 T 900 620 T 1350 620" stroke-opacity="0.3"/>
                <path d="M 0 520 Q 225 420 450 520 T 900 520 T 1350 520" stroke-opacity="0.45"/>
                <path d="M 0 420 Q 225 345 450 420 T 900 420 T 1350 420" stroke-opacity="0.55"/>
                <path d="M 0 320 Q 225 265 450 320 T 900 320 T 1350 320" stroke-opacity="0.65"/>
                <path d="M 0 220 Q 225 185 450 220 T 900 220 T 1350 220" stroke-opacity="0.5"/>
                <path d="M 0 120 Q 225 100 450 120 T 900 120 T 1350 120" stroke-opacity="0.32"/>
              </g>
            </svg>
          )}
          {v === 1 && (
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 2100 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="2100" height="900" fill="transparent"/>
              <g class="ripple-drift" fill="none" stroke="#1C1C1C">
                <circle cx="1480" cy="-160" r="780" stroke-opacity="0.85"/>
                <circle cx="1480" cy="-160" r="980" stroke-opacity="0.55"/>
                <circle cx="1480" cy="-160" r="1190" stroke-opacity="0.35"/>
                <circle cx="1480" cy="-160" r="1410" stroke-opacity="0.2"/>
                <circle cx="1480" cy="-160" r="1640" stroke-opacity="0.12"/>
              </g>
            </svg>
          )}
          {v === 2 && (
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 2100 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="2100" height="900" fill="transparent"/>
              <g class="contour-drift" fill="none" stroke="#1C1C1C">
                <path d="M 0 640 C 260 600 430 660 690 630 C 950 600 1120 680 1380 640 C 1640 600 1810 660 2100 630" stroke-opacity="0.8"/>
                <path d="M 0 560 C 310 510 520 590 780 550 C 1040 510 1250 600 1510 555 C 1770 515 1940 580 2100 560" stroke-opacity="0.55"/>
                <path d="M 0 480 C 270 420 520 510 780 465 C 1040 425 1290 520 1550 470 C 1810 435 1960 500 2100 480" stroke-opacity="0.4"/>
                <path d="M 0 400 C 340 340 560 430 820 385 C 1080 345 1330 440 1590 390 C 1850 360 1990 420 2100 400" stroke-opacity="0.28"/>
                <path d="M 0 320 C 300 270 580 350 840 305 C 1100 265 1360 350 1620 310 C 1880 292 2010 330 2100 320" stroke-opacity="0.18"/>
              </g>
            </svg>
          )}
        </div>

        <!-- 期号水印 -->
        <div class="absolute inset-0 flex items-end justify-center pb-5 md:pb-6 pointer-events-none z-20">
          <p class="font-serif text-xs md:text-sm tracking-[0.25em] text-white/80 drop-shadow-sm">
            第 {number} 期 · 创站第 {days} 天
          </p>
        </div>

        <!-- 大数字水印 -->
        <div class="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none z-10" aria-hidden="true">
          <span class="font-serif text-[180px] md:text-[280px] leading-none text-[var(--color-ed-fg)]/[0.06] select-none">
            {number}
          </span>
        </div>
      </div>

      <!-- 右：网站简介 -->
      <div class="intro-card md:w-[400px] lg:w-[460px] shrink-0 border-t md:border-t-0 md:border-l border-[var(--color-ed-faint)] p-8 lg:p-10 flex flex-col justify-between gap-8">
        <div>
          <p class="text-[10px] tracking-[0.3em] text-[var(--color-ed-subtle)] mb-6">
            关于本站 · ABOUT
          </p>
          <div class="space-y-3">
            {lines.map((l) => (
              <p class="font-serif text-base text-[var(--color-ed-fg)]/60 leading-relaxed">{l}</p>
            ))}
          </div>
        </div>
        <div>
          <p class="typewriter font-serif italic text-sm text-[var(--color-ed-muted)] mb-6">{note}</p>
          <p class="text-[10px] tracking-[0.2em] text-[var(--color-ed-subtle)]">
            SNARK — 随笔 · 技术 · 生活
          </p>
        </div>
      </div>
    </div>
  </div>
  <figcaption class="mt-3 text-[10px] tracking-[0.25em] text-[var(--color-ed-subtle)]">
    Fig. 01 — 刊首插图
  </figcaption>
</figure>
```

- [ ] **Step 3: 提交更改**

```bash
git add src/components/BannerPlate.astro
git commit -m "feat: add carousel support to BannerPlate component"
```

---

### Task 3: 添加轮播 JavaScript 逻辑

**Files:**
- Modify: `src/components/BannerPlate.astro`

- [ ] **Step 1: 在组件末尾添加轮播脚本**

在 `</figure>` 标签后添加：

```astro
<script>
  // Banner carousel with pause on hover
  const bannerLeft = document.querySelector('.banner-left');
  const slides = document.querySelectorAll('.banner-slide');
  
  if (slides.length > 1) {
    let currentIndex = 0;
    let intervalId: ReturnType<typeof setInterval>;
    let isPaused = false;

    function showSlide(index: number) {
      slides.forEach((slide, i) => {
        slide.classList.toggle('opacity-100', i === index);
        slide.classList.toggle('opacity-0', i !== index);
      });
    }

    function nextSlide() {
      if (!isPaused) {
        currentIndex = (currentIndex + 1) % slides.length;
        showSlide(currentIndex);
      }
    }

    function startAutoplay() {
      intervalId = setInterval(nextSlide, 5000);
    }

    function stopAutoplay() {
      clearInterval(intervalId);
    }

    // Pause on hover
    bannerLeft?.addEventListener('mouseenter', () => {
      isPaused = true;
    });

    bannerLeft?.addEventListener('mouseleave', () => {
      isPaused = false;
    });

    // Start autoplay
    startAutoplay();
  }
</script>
```

- [ ] **Step 2: 提交更改**

```bash
git add src/components/BannerPlate.astro
git commit -m "feat: add carousel autoplay with hover pause"
```

---

### Task 4: 添加动画样式

**Files:**
- Modify: `src/styles/editorial.css`

- [ ] **Step 1: 在 editorial.css 末尾添加动画样式**

```css
/* ===== Banner Carousel Animations ===== */

/* Line drift animations */
@keyframes line-drift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes ripple-drift {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes contour-drift {
  0%, 100% { transform: translateY(0) scaleX(1); }
  50% { transform: translateY(-5px) scaleX(1.01); }
}

.wave-drift {
  animation: line-drift 8s ease-in-out infinite;
}

.ripple-drift {
  animation: ripple-drift 10s ease-in-out infinite;
  transform-origin: center center;
}

.contour-drift {
  animation: contour-drift 12s ease-in-out infinite;
}

/* Banner slide transitions */
.banner-slide {
  transition: opacity 0.8s ease-in-out;
}

/* Intro card hover effect */
.intro-card {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.intro-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Typewriter effect */
.typewriter {
  overflow: hidden;
  border-right: 2px solid var(--color-ed-muted);
  white-space: nowrap;
  animation: typing 3s steps(20) forwards, blink-caret 0.75s step-end infinite;
}

@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes blink-caret {
  from, to { border-color: transparent; }
  50% { border-color: var(--color-ed-muted); }
}

/* Paper texture overlay */
.banner-left::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 5;
}
```

- [ ] **Step 2: 提交更改**

```bash
git add src/styles/editorial.css
git commit -m "feat: add banner animation styles and effects"
```

---

### Task 5: 修改首页传递轮播数据

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 在 frontmatter 中准备轮播数据**

在 `const vol = ...` 行后添加：

```typescript
// 轮播图片：优先使用文章封面，不足时用固定图片补充
const bannerSlides = [];
const postsWithImages = published.filter(p => p.data.heroImage);

// 添加文章封面
for (const post of postsWithImages.slice(0, 5)) {
  bannerSlides.push({
    image: post.data.heroImage,
    title: post.data.title,
    link: postUrl(post.id)
  });
}

// 如果不足 3 张，补充固定图片
const fallbackImages = [
  '/images/banner/fallback-1.jpg',
  '/images/banner/fallback-2.jpg',
  '/images/banner/fallback-3.jpg'
];

for (let i = 0; bannerSlides.length < 3 && i < fallbackImages.length; i++) {
  bannerSlides.push({
    image: fallbackImages[i]
  });
}
```

- [ ] **Step 2: 更新 BannerPlate 组件调用**

找到 `<BannerPlate variant={bannerVariant} days={daysStr} number={vol} />` 并替换为：

```astro
<BannerPlate
  variant={bannerVariant}
  days={daysStr}
  number={vol}
  slides={bannerSlides}
/>
```

- [ ] **Step 3: 提交更改**

```bash
git add src/pages/index.astro
git commit -m "feat: pass carousel data to BannerPlate component"
```

---

### Task 6: 优化目录展示（展开/收起）

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 修改目录部分支持展开/收起**

找到目录部分 `{listPosts.map((post, i) => {` 并替换为：

```astro
{listPosts.length > 0 && (
  <section class="pb-20 md:pb-28 px-6">
    <div class="mx-auto max-w-6xl">
      <div class="mask-reveal flex items-baseline justify-between border-b border-[var(--color-ed-faint)] pb-5 mb-8">
        <h2 class="text-xs tracking-[0.3em] text-[var(--color-ed-muted)]">目录 · CONTENTS</h2>
      </div>

      <!-- 前 3 篇始终显示 -->
      {listPosts.slice(0, 3).map((post, i) => {
        const readMin = readingTime(String(post.body || ""));
        return (
          <a
            href={postUrl(post.id)}
            class="group flex items-center gap-5 md:gap-8 py-5 md:py-6 border-b border-[var(--color-ed-faint)] no-underline"
          >
            <span class="font-serif text-lg md:text-xl text-[var(--color-ed-fg)] tracking-tight shrink-0">
              {String(i + 2).padStart(2, "0")}
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-4">
                <h3 class="font-serif text-xl md:text-2xl tracking-tight text-[var(--color-ed-fg)] leading-snug truncate italic">
                  {post.data.title}
                </h3>
                <span class="leader" aria-hidden="true"></span>
                <span class="shrink-0 text-xs text-[var(--color-ed-subtle)] tabular-nums">
                  {readMin} 分钟
                </span>
              </div>
              <div class="toc-excerpt">
                <div>
                  {post.data.excerpt && (
                    <p class="pt-2 text-sm leading-relaxed text-[var(--color-ed-muted)] line-clamp-2">
                      {post.data.excerpt}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <CoverPlate
              title={post.data.title}
              image={post.data.heroImage}
              variant={coverVariant(post.id)}
              ratioClass="aspect-square"
              caption={false}
              class="block w-12 h-12 md:w-14 md:h-14 shrink-0"
            />
          </a>
        );
      })}

      <!-- 超过 3 篇时显示展开按钮 -->
      {listPosts.length > 3 && (
        <details class="group/list">
          <summary class="flex items-center justify-center gap-2 py-4 cursor-pointer text-xs tracking-[0.2em] text-[var(--color-ed-subtle)] hover:text-[var(--color-ed-fg)] transition-colors">
            <span class="group-open/list:hidden">展开全部 {listPosts.length - 3} 篇</span>
            <span class="hidden group-open/list:inline">收起</span>
            <svg class="w-4 h-4 transition-transform group-open/list:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          
          <div class="hidden group-open/list:block">
            {listPosts.slice(3).map((post, i) => {
              const readMin = readingTime(String(post.body || ""));
              return (
                <a
                  href={postUrl(post.id)}
                  class="group flex items-center gap-5 md:gap-8 py-5 md:py-6 border-b border-[var(--color-ed-faint)] no-underline"
                >
                  <span class="font-serif text-lg md:text-xl text-[var(--color-ed-fg)] tracking-tight shrink-0">
                    {String(i + 5).padStart(2, "0")}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-4">
                      <h3 class="font-serif text-xl md:text-2xl tracking-tight text-[var(--color-ed-fg)] leading-snug truncate italic">
                        {post.data.title}
                      </h3>
                      <span class="leader" aria-hidden="true"></span>
                      <span class="shrink-0 text-xs text-[var(--color-ed-subtle)] tabular-nums">
                        {readMin} 分钟
                      </span>
                    </div>
                    <div class="toc-excerpt">
                      <div>
                        {post.data.excerpt && (
                          <p class="pt-2 text-sm leading-relaxed text-[var(--color-ed-muted)] line-clamp-2">
                            {post.data.excerpt}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <CoverPlate
                    title={post.data.title}
                    image={post.data.heroImage}
                    variant={coverVariant(post.id)}
                    ratioClass="aspect-square"
                    caption={false}
                    class="block w-12 h-12 md:w-14 md:h-14 shrink-0"
                  />
                </a>
              );
            })}
          </div>
        </details>
      )}
    </div>
  </section>
)}
```

- [ ] **Step 2: 提交更改**

```bash
git add src/pages/index.astro
git commit -m "feat: add expandable table of contents"
```

---

### Task 7: 改造标签云布局

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 修改标签部分为横排标签云**

找到标签部分 `{sortedTags.length > 0 ? (` 并替换为：

```astro
{sortedTags.length > 0 ? (
  <div class="flex flex-wrap gap-3 md:gap-4">
    {sortedTags.map(([tag, count]) => {
      // 根据文章数计算字体大小和颜色
      const maxCount = Math.max(...sortedTags.map(t => t[1]));
      const ratio = count / maxCount;
      const fontSize = 12 + Math.floor(ratio * 8); // 12px - 20px
      const opacity = 0.5 + ratio * 0.5; // 0.5 - 1.0
      
      return (
        <a
          href={`/tags/${tag.toLowerCase().replace(/\s+/g, "-")}`}
          class="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-ed-faint)] hover:border-[var(--color-ed-muted)] transition-colors no-underline"
          style={`font-size: ${fontSize}px; opacity: ${opacity};`}
        >
          <span class="font-serif text-[var(--color-ed-fg)] group-hover:text-[var(--color-ed-muted)] transition-colors">
            {tag}
          </span>
          <span class="text-[10px] text-[var(--color-ed-subtle)] tabular-nums">
            {count}
          </span>
        </a>
      );
    })}
  </div>
) : (
  <p class="text-sm text-[var(--color-ed-muted)]">暂无标签。</p>
)}
```

- [ ] **Step 2: 提交更改**

```bash
git add src/pages/index.astro
git commit -m "feat: redesign tags as horizontal tag cloud"
```

---

### Task 8: 测试和调优

**Files:**
- None (testing only)

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 检查首页显示效果**

访问 `http://localhost:4321`，检查：
- 轮播图片是否正常显示和切换
- 线条动画是否流畅
- 目录展开/收起功能是否正常
- 标签云布局是否正确
- 响应式布局是否适配

- [ ] **Step 3: 检查控制台错误**

打开浏览器开发者工具，检查是否有 JavaScript 错误或警告。

- [ ] **Step 4: 提交最终更改**

```bash
git add -A
git commit -m "chore: final adjustments and testing"
```

---

## 完成

所有任务完成后，首页将具备：
1. 封面图自动轮播（5秒间隔，悬停暂停）
2. 动态线条漂移动画
3. 视觉层次增强（卡片阴影、打字机效果）
4. 可展开/收起的目录
5. 横排标签云布局
