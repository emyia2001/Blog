import { requestUrl } from "obsidian";
import type { SnarkSettings } from "./settings";

/** R2（S3 兼容）直传配置；任一项为空即视为未启用 */
export interface R2Config {
  accessKey: string;
  secretKey: string;
  accountId: string;
  bucket: string;
  publicPrefix: string;
  keyPrefix: string;
}

export function r2Config(s: SnarkSettings): R2Config | null {
  if (!s.r2AccessKey || !s.r2SecretKey || !s.r2AccountId || !s.r2Bucket || !s.r2PublicPrefix) return null;
  return {
    accessKey: s.r2AccessKey,
    secretKey: s.r2SecretKey,
    accountId: s.r2AccountId,
    bucket: s.r2Bucket,
    publicPrefix: s.r2PublicPrefix.replace(/\/+$/, ""),
    keyPrefix: s.r2KeyPrefix.trim().replace(/^\/+|\/+$/g, ""),
  };
}

/** 对象键：blog/2026/11/15-<随机>.png（按日期归档，随机串防碰撞） */
export function buildObjectKey(prefix: string, ext: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  const parts = [
    ...(prefix ? [prefix] : []),
    String(now.getFullYear()),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ];
  return `${parts.join("/")}-${rand}.${ext}`;
}

const encoder = new TextEncoder();

async function hmacBytes(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data) as unknown as ArrayBuffer);
  return new Uint8Array(sig);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * AWS SigV4 签名一个 R2 的 S3 请求（region 固定 auto，service s3，path-style）。
 * 独立成纯函数便于与参考实现交叉验证。
 */
export async function signS3Request(opts: {
  accountId: string;
  bucket: string;
  key: string;
  accessKey: string;
  secretKey: string;
  method: "PUT" | "GET" | "DELETE";
  payloadHash: string;
  amzDate: string;
  query?: Record<string, string>;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${opts.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${opts.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const queryEntries = Object.entries(opts.query ?? {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`);
  const canonicalQuery = queryEntries.join("&");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${opts.payloadHash}\nx-amz-date:${opts.amzDate}\n`;
  const canonicalRequest = `${opts.method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${opts.payloadHash}`;
  const date = opts.amzDate.slice(0, 8);
  const stringToSign = `AWS4-HMAC-SHA256\n${opts.amzDate}\n${date}/auto/s3/aws4_request\n${await sha256Hex(encoder.encode(canonicalRequest))}`;

  let key: Uint8Array = encoder.encode(`AWS4${opts.secretKey}`);
  key = await hmacBytes(key, date);
  key = await hmacBytes(key, "auto");
  key = await hmacBytes(key, "s3");
  key = await hmacBytes(key, "aws4_request");
  const signature = toHex(await hmacBytes(key, stringToSign));

  return {
    url: `https://${host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    // 注意：host 是受限头，不能手动放进请求（Chromium 会报 ERR_INVALID_ARGUMENT）；
    // 它只参与签名计算（canonicalHeaders），实际请求的 host 由 URL 自动携带。
    headers: {
      "x-amz-content-sha256": opts.payloadHash,
      "x-amz-date": opts.amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${date}/auto/s3/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function s3Error(op: string, status: number): Error {
  const hint =
    status === 403
      ? "令牌权限不足（需对象读和写）或签名不匹配"
      : status === 404
        ? "桶名或账户 ID 有误"
        : status === 301
          ? "区域/端点有误"
          : "检查设置";
  return new Error(`R2 ${op}失败：HTTP ${status}（${hint}）`);
}

/** 签名并发起一个 S3 请求（body 为 null 时是 GET/DELETE；query 用于 ListObjectsV2） */
async function s3Request(
  method: "PUT" | "GET" | "DELETE",
  cfg: R2Config,
  key: string,
  body: Uint8Array | null,
  query?: Record<string, string>,
): Promise<{ status: number; text: string }> {
  const payloadHash = await sha256Hex(body ?? new Uint8Array(0));
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const { url, headers } = await signS3Request({
    accountId: cfg.accountId,
    bucket: cfg.bucket,
    key,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
    method,
    payloadHash,
    amzDate,
    query,
  });
  const res = await requestUrl({
    url,
    method,
    headers,
    body: body ? (body.buffer as ArrayBuffer) : undefined,
    throw: false,
  });
  let text = "";
  try {
    text = res.text;
  } catch {
    text = "";
  }
  return { status: res.status, text };
}

/** 上传一张图片到 R2，返回公网 URL（publicPrefix + 对象键） */
export async function uploadImageToR2(bytes: Uint8Array, ext: string, cfg: R2Config): Promise<string> {
  const key = buildObjectKey(cfg.keyPrefix, ext);
  const res = await s3Request("PUT", cfg, key, bytes);
  if (res.status >= 300) throw s3Error("上传", res.status);
  return `${cfg.publicPrefix}/${key}`;
}

/**
 * R2 直传连通性验证：上传一个小文本 → 读回比对 → 删除清理，
 * 完整验证写/读/删三个权限且不在桶里留垃圾。
 */
export async function verifyR2(cfg: R2Config): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${cfg.keyPrefix ? `${cfg.keyPrefix}/` : ""}.check-${rand}.txt`;
  const body = encoder.encode(`Snark 博客 R2 直传连通性验证 ${new Date().toISOString()}`);

  let res = await s3Request("PUT", cfg, key, body);
  if (res.status >= 300) throw s3Error("上传", res.status);

  res = await s3Request("GET", cfg, key, null);
  if (res.status >= 300) throw s3Error("读取", res.status);
  if (!res.text.startsWith("Snark 博客")) {
    throw new Error("R2 读取成功但内容不匹配（桶里可能有同名干扰或代理改写）");
  }

  res = await s3Request("DELETE", cfg, key, null);
  if (res.status >= 400) throw s3Error("清理", res.status);

  return "R2 直传验证通过（上传 / 读取 / 清理均正常）";
}

// ---------- 图床对象管理（列举 / 删除） ----------

export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: string;
}

export interface R2Listing {
  objects: R2ObjectInfo[]; // 当前层级的对象
  folders: string[]; // 当前层级的「文件夹」前缀（以 / 结尾）
  truncated: boolean;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 列举桶内对象（ListObjectsV2 + delimiter 分层：返回当前层级的对象与文件夹；单页最多 1000 个） */
export async function listR2Objects(cfg: R2Config, prefix: string, delimiter = "/"): Promise<R2Listing> {
  const query: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
  if (prefix) query.prefix = prefix;
  if (delimiter) query.delimiter = delimiter;
  const res = await s3Request("GET", cfg, "", null, query);
  if (res.status >= 300) throw s3Error("列举", res.status);
  const xml = res.text;

  const objects: R2ObjectInfo[] = [];
  const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m: RegExpExecArray | null;
  while ((m = contentsRe.exec(xml))) {
    const block = m[1];
    const pick = (tag: string): string => {
      const t = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return t ? decodeXmlEntities(t[1]) : "";
    };
    objects.push({ key: pick("Key"), size: Number(pick("Size")) || 0, lastModified: pick("LastModified") });
  }

  // 文件夹只在 <CommonPrefixes> 块里；顶层 <Prefix> 是请求回显，不能当文件夹
  const folders: string[] = [];
  const cpBlockRe = /<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g;
  while ((m = cpBlockRe.exec(xml))) {
    const p = m[1].match(/<Prefix>([\s\S]*?)<\/Prefix>/);
    if (p && p[1]) folders.push(decodeXmlEntities(p[1]));
  }

  return { objects, folders, truncated: /<IsTruncated>true<\/IsTruncated>/.test(xml) };
}

/** 删除一个对象；不存在（404）视为已删除 */
export async function deleteR2Object(cfg: R2Config, key: string): Promise<void> {
  const res = await s3Request("DELETE", cfg, key, null);
  if (res.status >= 400 && res.status !== 404) throw s3Error("删除", res.status);
}

/** 分页拉全桶对象（ListObjectsV2 + continuation-token，无 delimiter = 递归全量） */
export async function listAllR2Objects(cfg: R2Config, prefix = ""): Promise<R2ObjectInfo[]> {
  const all: R2ObjectInfo[] = [];
  let token: string | undefined;
  do {
    const query: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
    if (prefix) query.prefix = prefix;
    if (token) query["continuation-token"] = token;
    const res = await s3Request("GET", cfg, "", null, query);
    if (res.status >= 300) throw s3Error("列举", res.status);
    const xml = res.text;

    const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m: RegExpExecArray | null;
    while ((m = contentsRe.exec(xml))) {
      const block = m[1];
      const pick = (tag: string): string => {
        const t = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return t ? decodeXmlEntities(t[1]) : "";
      };
      all.push({ key: pick("Key"), size: Number(pick("Size")) || 0, lastModified: pick("LastModified") });
    }
    const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/);
    token = next ? decodeXmlEntities(next[1]) : undefined;
  } while (token);
  return all;
}
