# online-counter · 博客实时在线人数

> **状态：方案已备好，暂未启用。** 线上站点完全没动过——`src/` 里没有这个功能的任何代码，
> 页脚也不显示这一行。想上线时按文末「启用清单」走一遍即可（约 10 分钟，含部署）。

页脚那行「**此刻 N 人在读**」的后端。基于 Cloudflare Worker + Durable Object + WebSocket，
参考 [IcyBlog：把博客在线人数迁到 Cloudflare Durable Object](https://blog.icybit.cn/posts/42/)，
但改用 **Hibernatable WebSocket**（空闲可休眠，不产生 duration 计费）。

![页脚效果](preview.png)

## 它是怎么工作的

```text
浏览器 ──wss──▶ Worker /ws ──▶ DurableObject「OnlineCounterRoom」
                                  └─ 连接集合变化时，把 { online: N } 广播给所有人
```

- **同一个房间**：所有访客都进 `idFromName("global")` 这一个 DO 实例，连接集合的长度就是在线人数。
- **休眠友好**：用 `state.acceptWebSocket()` 托管连接 + `webSocketMessage/Close/Error` 回调，
  没有连接活动时 DO 被休眠，不按「常驻内存」计费；所以代码里**没有** `setInterval` 广播。
- **心跳**：客户端每 30s 发一次 `"ping"`，只回它自己最新人数（不广播，避免写放大）。
- **来源白名单**：`ALLOWED_ORIGINS` 只放行自己的博客域名，别的站不能拿去蹭。
- **HTTP 端点**：`GET /count` 返回 `{ "online": N }`，方便调试或非长连接场景使用。
- **关页面时不会多算**：`webSocketClose` 触发时运行时还没把待关闭连接从 `getWebSockets()` 移除，
  所以 `broadcast(excluding)` 会显式排除它（否则剩下的人会看到多 1 的旧数字，直到下次心跳）。

## 目录

```text
workers/online-counter/
├─ src/index.ts              Worker + OnlineCounterRoom（全部逻辑，约 150 行）
├─ wrangler.jsonc            部署配置（DO 绑定、迁移、来源白名单）
├─ package.json              只装 wrangler 用于部署；与博客自身的构建完全无关
├─ frontend/OnlineNow.astro  页脚组件（停放中，未接进 src/，不参与构建）
└─ preview.png               上线后的样子
```

## 部署步骤

> 前置：博客域名已在 Cloudflare，本机可用浏览器完成 `wrangler login`。
> Durable Object 在 **Workers 免费版**即可用（仅支持 SQLite 存储后端，配置里已用 `new_sqlite_classes`）。

### 1. 安装依赖 / 登录

```bash
cd workers/online-counter
npm install
npx wrangler login          # 浏览器授权；CI 环境改用 CLOUDFLARE_API_TOKEN
```

### 2. 确认白名单

打开 `wrangler.jsonc` 的 `vars.ALLOWED_ORIGINS`，确认包含博客正式域名（默认已含
`https://snarkm.com`）：

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://snarkm.com,http://localhost:4321"
}
```

如果还有 `*.pages.dev` 预览域名想统计，加进这个逗号分隔列表即可。

### 3. 部署并冒烟测试

```bash
npx wrangler deploy
# 输出里会给出 https://online-counter.<你的子域>.workers.dev

curl -H "Origin: https://snarkm.com" https://online-counter.<你的子域>.workers.dev/count
# → {"online":0}
```

### 4. 绑一个自定义域名（推荐）

`*.workers.dev` 在国内经常被墙，而 `snarkm.com` 本身就过 Cloudflare，走同 zone 的自定义域名最稳。

Dashboard → **Workers & Pages → online-counter → Settings → Domains & Routes → Add → Custom domain**
→ 填 `online.snarkm.com`（会自动建对应 DNS 记录）。

完成后 `https://online.snarkm.com/count` 应返回 `{"online":0}`。

### 5. 接到博客上

见文末「启用清单」第 2~5 步（组件在 `frontend/`，需复制回 `src/components/`）。

## 本地调试

两个终端：

```bash
# A：Worker（监听 8788）
cd workers/online-counter && npx wrangler dev --local --port 8788

# B：博客
npm run dev                    # http://localhost:4321
```

此时把 `ONLINE_COUNTER_WS` 临时改成 `ws://localhost:8788/ws`，并确保 Worker 的
`ALLOWED_ORIGINS` 含 `http://localhost:4321`，否则连接会被 403 拒绝。

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 页脚一直不出现 | 地址没填、地址不是 `wss://`（https 站点混用 `ws://` 会被拦）、或 Worker 未部署 |
| 控制台 403 | 当前页面的 Origin 不在 `ALLOWED_ORIGINS` 里（预览域名、http/https、端口都要完全一致） |
| `curl /ws` 返回 426 | 正常：`/ws` 需要 WebSocket 升级头 |
| 人数明显偏大 | 同一访客开了多个标签页会算多次；关页面时连接才释放 |
| 想统计累计 PV/UV | 这不是本方案的用途；可在同一 DO 里用 `state.storage` 累加计数，另开一个 `/hit` 端点 |

## 计费

Workers 免费版含 Durable Objects（SQLite 后端）与 WebSocket；本方案的连接都是 hibernatable，
空闲时不占 duration 计费，量级到「一个博客的在线人数」远低于免费额度。

---

## 启用清单（想上线时照做）

代码已写完并在本地端到端验证过（见下方「已验证」），上线只差这几步：

```bash
# 1. 部署 Worker（首次要 wrangler login）
cd workers/online-counter && npm install && npx wrangler login && npx wrangler deploy

# 2. 绑自定义域名（Dashboard 操作，可选但推荐）：online.snarkm.com

# 3. 组件放回 src/
cp workers/online-counter/frontend/OnlineNow.astro /root/blog/src/components/
```

4. `src/consts.ts` 加一行（放在 `GITHUB_REPO` 上方）：

   ```ts
   // 页脚实时在线人数：地址留空 = 不显示；Worker 连不上时该行保持隐藏
   export const ONLINE_COUNTER_WS = "wss://online.snarkm.com/ws";
   ```

5. `src/components/Footer.astro` 挂载：

   ```astro
   import OnlineNow from "./OnlineNow.astro";
   ...
   <OnlineNow />   <!-- 放在页脚最内层那个 flex-col 容器的末尾 -->
   ```

6. `npm run build` 通过后提交推送，等 Pages 重建完成即可在页脚看到。

**想撤回**：删掉 Footer 里的 `<OnlineNow />` 与 consts 里那行即可（组件在 `src/` 里留着也无害，
因为地址为空时它不渲染任何 DOM、也不打包脚本）。Worker 本身可以 `npx wrangler delete`，
或先留着不删——没有连接时它基本不产生费用。

## 已验证（2026-10-21，本地）

- `wrangler deploy --dry-run` 打包通过（4.26 KiB，DO 绑定正确）。
- Worker 本地实测：第 1 个连接收到 `{online:1}`、第 2 个进来时两人都收到 `{online:2}`、
  `ping` 有回执、一方断开后剩余连接收到正确人数、`/count` 与广播一致；
  非白名单 Origin → 403，非升级请求 → 426。
- 浏览器端到端（真实 Chromium + `astro preview`）：`此刻 1 人在读` → 第二访客 `此刻 2 人在读`
  → 离开后回 `此刻 1 人在读`；点导航走 ViewTransitions 后仍显示、**只建 1 条连接**；
  390px 移动端正常；关掉 Worker 后整行隐藏且无 JS 异常。
- 样式度量：11px、`rgba(28,28,28,.4)`、6px 砖红圆点、居中、无横向溢出。
- `npm run build` 在「地址为空」与「地址已填」两种情况下都零报错；地址为空时产物里
  不含 `data-online-now`（零残留）。

## 已知边界

- 同一人开多个标签页会算多人；关页面/断网后连接才释放，人数起落有一两秒抖动。
- 只统计**实时在线**，不是 PV/UV；要累计浏览量需在同一 DO 里用 `state.storage` 另开 `/hit`。
- `*.pages.dev` 预览域名默认不在白名单（预览站上不显示），需要就加进 `ALLOWED_ORIGINS`。
- 页面隐藏（切后台）时不断开连接，所以「挂着不动的标签页」也会被计入。
