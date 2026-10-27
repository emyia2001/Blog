/**
 * online-counter —— 博客实时在线人数（Cloudflare Worker + Durable Object）
 *
 * 结构：
 *   浏览器 --wss--> Worker /ws --> DurableObject(OnlineCounterRoom) 维护连接集合
 *                                  └─ 有增减时把 { online: N } 广播给集合内所有连接
 *
 * 设计要点：
 * - 全部连接进同一个 Durable Object 实例（idFromName("global")），集合长度即在线人数。
 * - 用 Hibernatable WebSocket（state.acceptWebSocket）+ webSocketMessage/Close/Error
 *   回调，空闲时 DO 会被休眠、不计 duration 费用；因此这里绝不能用 setInterval 广播。
 * - 连接增减时广播；客户端每 30s 发一次 "ping"，只回它自己最新人数（不广播，省写放大）。
 * - /count 供非长连接场景（静态页、审计、调试）查询当前人数。
 */

const ROOM_NAME = "global";

export interface Env {
  ONLINE_COUNTER: DurableObjectNamespace;
  /**
   * 逗号分隔的允许来源，如 "https://snarkm.com,http://localhost:4321"。
   * 留空 = 不校验来源（仅建议本地调试时这样用）。
   */
  ALLOWED_ORIGINS?: string;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(env: Env, origin: string | null): boolean {
  const list = allowedOrigins(env);
  if (list.length === 0) return true;
  return origin !== null && list.includes(origin);
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { vary: "Origin" };
  if (origin && isOriginAllowed(env, origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, OPTIONS";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

function room(env: Env): DurableObjectStub {
  return env.ONLINE_COUNTER.get(env.ONLINE_COUNTER.idFromName(ROOM_NAME));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    if (url.pathname === "/count") {
      if (!isOriginAllowed(env, origin)) {
        return json({ error: "origin not allowed" }, 403, corsHeaders(env, origin));
      }
      const res = await room(env).fetch(new Request("https://room/count"));
      const data = (await res.json()) as { online: number };
      return json({ online: data.online }, 200, corsHeaders(env, origin));
    }

    if (url.pathname === "/ws") {
      if ((request.headers.get("Upgrade") ?? "").toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade\n", { status: 426 });
      }
      if (!isOriginAllowed(env, origin)) {
        return new Response("Origin not allowed\n", { status: 403 });
      }
      return room(env).fetch(request);
    }

    return new Response("online-counter is running\n\nGET /count  -> { \"online\": N }\nGET /ws     -> WebSocket, 推送 { \"online\": N }\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
} satisfies ExportedHandler<Env>;

export class OnlineCounterRoom implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/count") {
      return json({ online: this.online() });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // 交给运行时托管：空闲可休眠，连接仍保留
    this.state.acceptWebSocket(server);
    // 新连接进来，人数变了 —— 广播给房间里所有人（含自己）
    this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  /** 当前连接数 = 房间里 WebSocket 数量 */
  private online(): number {
    return this.state.getWebSockets().length;
  }

  /**
   * 广播当前人数。
   * 注意：走 webSocketClose / webSocketError 时，运行时还没把待关闭的连接从
   * getWebSockets() 里移除（实测会多算 1），所以要显式把这个连接排除掉。
   */
  private broadcast(excluding?: WebSocket): void {
    const sockets = this.state.getWebSockets();
    const stillListed = excluding !== undefined && sockets.includes(excluding);
    const online = Math.max(0, sockets.length - (stillListed ? 1 : 0));
    const message = JSON.stringify({ online });
    for (const socket of sockets) {
      try {
        // 1 === WebSocket.OPEN，已经关掉/出错的不再写
        if (socket.readyState !== 1) continue;
        socket.send(message);
      } catch {
        // 单个连接写失败不影响其他人
      }
    }
  }

  /** 客户端心跳（每 30s 一次 "ping"）：只回自己，不广播 */
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (message === "ping") {
      try {
        socket.send(JSON.stringify({ online: this.online() }));
      } catch {
        // ignore
      }
    }
  }

  webSocketClose(socket: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    this.broadcast(socket);
  }

  webSocketError(socket: WebSocket, _error: unknown): void {
    this.broadcast(socket);
  }
}
