/**
 * 站点 API Worker：
 *   /api/bark  —— 友链申请提醒（Bark 推送到站长手机）
 *   /api/likes —— 纪事点赞聚合（KV 计数）
 *   /api/weather —— 票面天气（request.cf 定位访客 → Worker 侧拉 open-meteo）
 * 其余请求全部透传给静态资源（env.ASSETS.fetch），行为与纯静态部署一致：
 * 有匹配资源时由 assets 直接服务（不经过本 Worker，不计 Worker 请求），
 * 未匹配的路径（如 /api/bark）才会进到这里。
 *
 * 一次性配置：
 *   1. 限次落 KV（每人每天一次跨实例生效）：
 *      npx wrangler kv namespace create BARK_LIMIT
 *      把返回的 id 填进 wrangler.jsonc 的 kv_namespaces 并取消注释。
 *      未绑定 KV 时退化为单实例内存限次（isolate 重启即清零，聊胜于无）。
 *      点赞计数复用同一命名空间（likes:/like: 前缀区分，不另建资源）。
 *   2. npx wrangler secret put BARK_KEY —— Bark 设备 key（不进仓库）。
 *      自建 Bark 服务端时用 BARK_SERVER 变量指向，默认 api.day.app。
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  BARK_LIMIT?: {
    get: (key: string) => Promise<string | null>;
    put: (
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ) => Promise<void>;
  };
  BARK_KEY?: string;
  BARK_SERVER?: string;
}

// KV 记录两天过期：跨时区/跨日边界时残留记录不影响次日判定
const HIT_TTL = 60 * 60 * 48;
// 限次以北京时间的自然日为界
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
// 全站每日推送上限（第二道防线：防止多 IP 刷爆）
const DAILY_CAP = 20;
// 同一访客对同一条目的点赞去重窗口：窗口内再点不再计数（本地红心仍可取消/点亮）
const LIKE_DEDUPE_TTL = 60 * 60 * 24;
// 条目锚点格式：moment-/diary- 前缀 + 日期（其余一律拒收）
const LIKE_ID_RE = /^[a-z0-9-]{1,64}$/;
// 聚合计数的 KV 单键（JSON blob）；KV 非原子，并发下允许 ±1~2 漂移
const LIKE_COUNTS_KEY = "likes:counts";

// KV 未绑定时的降级：单实例内存 shim，与 KV 同构（isolate 重启即清零，聊胜于无）
const memoryKV = new Map<string, string>();

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const kvStore = (env: Env) =>
  env.BARK_LIMIT ?? {
    get: async (key: string) => memoryKV.get(key) ?? null,
    put: async (key: string, value: string) => {
      memoryKV.set(key, value);
    },
  };

// IP 只存 SHA-256 哈希：KV 里不落原始地址
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 仅接受同源调用：挡住其他网站把访客当免费按钮盗用接口
// （curl 等无 Origin 的调用放行，真正的防线是各自的后端限次）
function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function readCounts(store: ReturnType<typeof kvStore>) {
  try {
    const raw = await store.get(LIKE_COUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

// ===== /api/likes：GET 聚合数；POST { id } 计数 +1（24h 去重）=====
async function handleLikes(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const store = kvStore(env);

  if (request.method === "GET") {
    return json({ ok: true, likes: await readCounts(store) });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!sameOrigin(request, url)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let id = "";
  try {
    const body = (await request.json()) as { id?: unknown };
    id = typeof body?.id === "string" ? body.id : "";
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (!LIKE_ID_RE.test(id)) {
    return json({ ok: false, error: "bad_id" }, 400);
  }

  const ipHash = await sha256Hex(clientIp(request));
  const dedupeKey = `like:${ipHash}:${id}`;

  // 窗口内重复点赞：不再计数，但返回当前聚合数（前端展示保持一致）
  if (await store.get(dedupeKey)) {
    return json({ ok: true, count: (await readCounts(store))[id] ?? 0, deduped: true });
  }

  const counts = await readCounts(store);
  counts[id] = (counts[id] ?? 0) + 1;
  try {
    await store.put(LIKE_COUNTS_KEY, JSON.stringify(counts));
    await store.put(dedupeKey, "1", { expirationTtl: LIKE_DEDUPE_TTL });
  } catch (err) {
    console.error("[likes] store failed:", err);
  }
  return json({ ok: true, count: counts[id] });
}

// ===== /api/weather：票面天气 =====
// request.cf 按 IP 定位访客 → Worker 侧请求 open-meteo（免 key）。
// 要点：天气接口在国内网络常不可达，改由 Cloudflare 边缘出网，访客只打同源请求。
// 无 cf（本地 dev 等）时用查询参数兜底（前端传默认城市坐标）。
// 不落库、不记录 IP；上游失败返回 { ok:false }，前端只显示日期。
type CfProps = {
  city?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
};
async function handleWeather(request: Request, url: URL): Promise<Response> {
  const cf = (request as Request & { cf?: CfProps }).cf;
  let lat = Number(cf?.latitude);
  let lon = Number(cf?.longitude);
  let city = cf?.city ?? cf?.region ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = Number(url.searchParams.get("lat"));
    lon = Number(url.searchParams.get("lon"));
    city = url.searchParams.get("city") ?? "";
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json({ ok: false });
    }
  }
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!res.ok) return json({ ok: false });
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    if (typeof temp !== "number" || typeof code !== "number") {
      return json({ ok: false });
    }
    return new Response(
      JSON.stringify({ ok: true, city, code, temp: Math.round(temp) }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=600",
        },
      }
    );
  } catch (err) {
    console.error("[weather] upstream failed:", err);
    return json({ ok: false });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/weather") return handleWeather(request, url);
    if (url.pathname === "/api/likes") return handleLikes(request, env, url);
    if (url.pathname !== "/api/bark") return env.ASSETS.fetch(request);
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    if (!sameOrigin(request, url)) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    const ip = clientIp(request);
    const day = today();
    const limitKey = `bark:${ip}:${day}`;
    const capKey = `bark:cap:${day}`;
    const store = kvStore(env);

    // 第一层：每人每天一次
    if (await store.get(limitKey)) {
      return json({ ok: false, error: "already_sent" }, 429);
    }

    if (!env.BARK_KEY) {
      return json({ ok: false, error: "bark_not_configured" }, 503);
    }

    // 第二层：全站每天最多 20 条（防多 IP 刷推送；KV 计数非原子，
    // 并发下允许 ±1~2 条漂移，对滥用防护足够）
    const capCount = Number((await store.get(capKey)) ?? 0);
    if (capCount >= DAILY_CAP) {
      return json({ ok: false, error: "daily_cap" }, 429);
    }

    const server = (env.BARK_SERVER ?? "https://api.day.app").replace(/\/$/, "");
    const bjTime = new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    });
    const push = await fetch(`${server}/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device_key: env.BARK_KEY,
        title: "友链申请提醒",
        body: `有访客点击了「申请友链」按钮（${bjTime}）`,
        group: "friend-link",
      }),
    });
    if (!push.ok) {
      console.error(`[bark] push failed: ${push.status}`);
      return json({ ok: false, error: "bark_push_failed" }, 502);
    }

    // 推送成功才消耗名额（失败可重试，不白占名额）；KV 写失败不影响
    // 推送结果——下次点击会重试记录，最多多发一条
    try {
      await store.put(limitKey, "1", { expirationTtl: HIT_TTL });
      await store.put(capKey, String(capCount + 1), {
        expirationTtl: HIT_TTL,
      });
    } catch (err) {
      console.error("[bark] limit store failed:", err);
    }
    return json({ ok: true });
  },
};
