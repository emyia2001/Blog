# plans/ — 动效改进执行计划

来源：improve-animations 全量审计（2026-11-11，基于 commit `f53cba8`）。
四路并行审计（用途/频率、缓动/时长、物理感/可中断性、性能/可访问性、一致性/机会）产出 16 项发现，用户选择全部立项，两项同文件同模式合并（002），共 15 份计划。

## 计划总表

| # | 计划 | 严重度 | 类别 | 状态 |
|---|---|---|---|---|
| 001 | MiniPlayer 按压反馈修复 | HIGH | 频率/可中断 | DONE |
| 002 | 对话框退场曲线 + 可中断 transition（FriendTreeDialog + 拾集详情） | MEDIUM | 缓动/可中断 | DONE |
| 003 | 悬停位移统一 hover-gate（触屏粘滞） | MEDIUM | 可访问性 | DONE |
| 004 | reduced-motion 缺口补全 + 误杀反馈修复 | MEDIUM | 可访问性 | DONE |
| 005 | 进度条/评分条布局属性改 transform | MEDIUM | 性能 | DONE（ed-progress 用独立 `translate` 属性——transform 被 JS 逐帧占用，见计划执行备注） |
| 006 | 灯箱蒙层入场改 transition（快速关闭卡住） | MEDIUM | 可中断 | DONE |
| 007 | 补齐缺失按压反馈（图谱/书架/对话框/上下篇） | MEDIUM | 物理感 | DONE |
| 008 | 缓动 token 收敛（手打贝塞尔归位） | LOW | 一致性 | DONE |
| 009 | 搜索加载条循环曲线改 linear | LOW | 缓动 | DONE |
| 010 | 性能杂项（进度线 scaleX / will-change / Nav rAF / qrtree 停帧） | LOW | 性能 | DONE（qrtree settled 表达式已修正 reduced-motion 下的 burst 条件） |
| 011 | 去掉标签 chip 装饰性倾斜 | LOW | 频率 | DONE |
| 012 | 图谱全屏 FLIP 展开/还原 + 遮罩淡出 + 图标旋转 | MEDIUM | 机会 | DONE（淡出选择器按实际 reparent 顺序修正，见计划执行备注） |
| 013 | 热力图 tooltip 滑行 | LOW | 机会 | DONE |
| 014 | 友链页/标签云入场错峰 | LOW | 机会 | DONE |
| 015 | 复制按钮标签交叉淡化 | LOW | 机会 | DONE |
| 016 | 阅读进度条：初始化不播滑落 + 导航收起淡出隐藏 | MEDIUM | 用户反馈修正 | DONE |
| 017 | 删除四周装饰边框 body::before（初版「顶线淡出」方案经用户反馈改为整圈删除） | MEDIUM | 用户反馈修正 | DONE |
| 018 | 导航切换提速：prefetch 全量预取 + 导航链接 viewport 预取 + 错峰封顶 300ms | HIGH | 性能 | DONE |
| 019 | 导航换页零动画：VT 全禁用（root + site-nav）、nav-fast 跳过入场编排、归档年份线覆盖、移除选中线落定重播（v2：用户决策放弃 80/140ms 极短方案，改零动画；首访编排保留） | HIGH | 用户反馈修正 | DONE（部分被 020 替代） |
| 020 | 全局换页过渡：顶部加载条 + 极短交叉淡化 | HIGH | 用户反馈修正 | DONE（被 021 替代） |
| 021 | 全局换页遮罩 veil：纸色盖屏 180ms（状态机保证最短盖屏）→ swap（root VT 零动画）→ 揭开 240ms；替代 020 | HIGH | 用户反馈修正 | DONE（被 022 替代） |
| 022 | 遮罩改墨色滑动擦除：底部滑上盖屏 120ms → 继续上滑揭开 180ms，连续运动无静止等待，总 ~300ms；替代 021 | HIGH | 用户反馈修正 | DONE（被 023 替代） |
| 023 | 遮罩改横向幕布擦除：纸色面板左→右扫入 160ms / 继续右扫揭开 200ms，左右缘 2px 砖红前缘/揭示线（呼应站点 hairline 语言），总 ~360ms；替代 022 | HIGH | 用户反馈修正 | DONE（被 024 替代） |
| 024 | 换页过渡改原点圆形揭示：删除遮罩系统，新页快照从点击的导航位置 clip-path circle 扩散盖过静止垫底的旧页（300ms expo-out；键盘回落导航带居中；reduce 即时切换）——Material container-transform / Chrome VT 演示模式 | HIGH | 用户反馈修正 | DONE（缓动被 025 修正） |
| 025 | 揭示缓动修正：expo-out 在感知上等于瞬间（慢放截图证实）→ 400ms 强 ease-in-out（cubic-bezier(.77,0,.175,1)）全程可见；加载条回归但 300ms 延迟门仅真等待出现 | HIGH | 用户反馈修正 | DONE（被 026 替代） |
| 026 | 换页过渡改磨砂对焦：点击当帧整页失焦（backdrop-filter 磨砂 100ms 快起，opacity 渐变即 blur 渐增）→ swap → 260ms 对焦呈现；VT 回归零动画，删除圆形揭示与坐标捕获 | HIGH | 用户反馈修正 | DONE |
| 027 | 关系图谱：fitViewBox 重排后离线预跑 90 tick + 手动 ticked + 低 alpha 重启（首帧即分散形态，无聚拢漂移）；友链头像半径 9.5→12（与自我头像同大）；syncBands 环带放宽（v2 修正：手动 tick 不派发渲染、fitViewBox 会重摆，预跑须在 fitViewBox 内） | MEDIUM | 用户反馈修正 | DONE |
| 028 | 友链文章环绕布局：friendPost 不上外带扇形，改为环绕各自友链站点节点的圆环（layoutRadial 环形布置 + 新增 forceFriendRing 环绕力 + bandLinkDistance 改环半径 + forceBandEllipse 豁免） | MEDIUM | 用户反馈修正 | DONE |
| 029 | 图谱改确定性静态布局：移除节点拖拽（保留画布平移/缩放/点击详情），力导仅离线松弛后定格（无定时器无漂移，默认初始化位=最终位，t1500/t3500 帧完全一致验证）；提示文案同步 | MEDIUM | 用户反馈修正 | DONE |
| 030 | 图谱跨换页重初始化：修复「第二次客户端换页到达归档页图谱死亡」——模块每会话只求值一次而 VT 换页替换 DOM，原版即无重初始化机制（预先存在的 bug，CDP 复现第 1 次 20/20、第 2/3 次 0/0）；改为 astro:page-load + mount.dataset.inited 驱动 armGraph，4 轮换页全部 20/20 验证 | HIGH | 功能修复 | DONE |

**执行记录**（2026-11-11，5 波次全部完成，`npx astro check` 0 错误 0 警告；未提交，待人工 feel-check 后自行提交）：
- 波 1（001/006/009/013/014）→ 波 2（002/010/015）→ 波 3（005/012）→ 波 4（007/008）→ 波 5（011→003→004 顺序）。
- 执行中的计划外修正：006 后灯箱蒙层 reduce 规则失配 → 波 5 补 150ms linear 分支；013 后 heat-tip reduce 块误杀淡入 → 波 5 改 opacity-only；010 的 settled 表达式 burst 条件修正。
- 003 的自查结论：站内 scaleX 下划线绘制（`.hover-underline::after` 等）与 `:focus-visible` 共享选择器、属编辑风招牌微交互，**有意保留**在 gate 外。

## 推荐执行顺序（按文件互斥分 5 波，波内并行、波间串行）

同一波内计划不共享文件，可并行派发；跨波必须等上一波完成（editorial.css / collection.astro / GraphView.astro / MiniPlayer.astro / timeline.astro 被多个计划触碰）。

| 波 | 计划 | 文件集 |
|---|---|---|
| 1 | 001, 006, 009, 013, 014 | MiniPlayer / ImageLightbox / SearchModal / ContributionHeatmap / friends+TagCloud+tags/index |
| 2 | 002, 010, 015 | FriendTreeDialog+collection / MiniPlayer+timeline+Nav+qrtree / rehype+editorial.css+BaseLayout |
| 3 | 005, 012 | editorial.css+collection / GraphView |
| 4 | 007, 008 | GraphView+collection+PrevNext / timeline+ImageLightbox（GraphView 的 JS 注释并入 007 执行） |
| 5 | 011 → 003 → 004（单代理顺序执行） | editorial.css 等广域收尾 |

依赖说明：
- 002 重写对话框动画 → 008 的 collection/FriendTreeDialog 曲线替换以 002 后的代码为准；004 的对话框 reduce 块以 002 后结构为准。
- 007 新增 `:active` → 004 给 shape/halo 的 reduce 覆盖需覆盖到它。
- 010 触碰 timeline `will-change` 行 → 008 同文件相邻行（transition 曲线），串行无冲突。
- 015 先于 003/004 动 editorial.css 的复制按钮区域。
- 012 最后于 GraphView 其他小改（008 注释/007 active）之后执行最稳，故在波 3…（008 波 4 晚于 012 波 3，均为注释级/样式级小改，冲突面为零，可按波执行）。

## 全局验收

- 每波完成后：`git diff --stat` 复核改动面 + 抽查关键 diff。
- 全部完成后：`npx astro check` 通过；手动 feel-check 各计划的 Verification 节（重点：002 的 Esc 中断、012 的展开/还原、003 的触屏模拟、004 的 reduce 面板）。
- 提交建议：Conventional Commits 中文（如 `feat: 图谱全屏 FLIP 展开` / `fix: 播放键按压反馈`），可按计划粒度分批提交。
