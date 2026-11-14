/**
 * 站点 API Worker：/api/bark —— 友链申请提醒（Bark 推送到站长手机）。
 * 其余请求全部透传给静态资源（env.ASSETS.fetch），行为与纯静态部署一致：
 * 有匹配资源时由 assets 直接服务（不经过本 Worker，不计 Worker 请求），
 * 未匹配的路径（如 /api/bark）才会进到这里。
 *
 * 一次性配置：
 *   1. 限次落 KV（每人每天一次跨实例生效）：
 *      npx wrangler kv namespace create BARK_LIMIT
 *      把返回的 id 填进 wrangler.jsonc 的 kv_namespaces 并取消注释。
 *      未绑定 KV 时退化为单实例内存限次（isolate 重启即清零，聊胜于无）。
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

// KV 未绑定时的降级：单实例内存 shim，与 KV 同构（isolate 重启即清零，聊胜于无）
const memoryKV = new Map<string, string>();

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/bark") return env.ASSETS.fetch(request);
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    // 仅接受同源调用：挡住其他网站把访客当免费推送按钮盗用这个接口
    // （curl 等无 Origin 的调用放行，真正的防线是下面的双层限次）
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== url.origin) {
          return json({ ok: false, error: "forbidden" }, 403);
        }
      } catch {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    }

    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const day = today();
    const limitKey = `bark:${ip}:${day}`;
    const capKey = `bark:cap:${day}`;
    // 绑定 KV 则跨实例生效；未绑定退化为内存 shim（尽力而为）
    const store =
      env.BARK_LIMIT ??
      {
        get: async (key: string) => memoryKV.get(key) ?? null,
        put: async (key: string, value: string) => {
          memoryKV.set(key, value);
        },
      };

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
