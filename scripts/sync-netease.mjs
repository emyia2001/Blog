#!/usr/bin/env node
/**
 * 网易云歌单 → 专辑封面数据
 *
 * 用法：
 *   node scripts/sync-netease.mjs                     # 使用脚本内 DEFAULT_PLAYLIST_ID
 *   node scripts/sync-netease.mjs <playlistId>        # 指定歌单
 *   NETEASE_PLAYLIST_ID=123 node scripts/sync-netease.mjs
 *
 * 产出：src/data/music.generated.ts（提交进仓库；构建只读该文件，不联网）
 *
 * 说明：
 * - 只支持**公开歌单**（私有歌单的 trackIds 需要登录 cookie）。
 * - 接口是非官方的，随时可能变；失败时不写文件，保留上一版数据。
 * - 专辑按 album.id 去重，顺序沿用歌单里首次出现的顺序。
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PLAYLIST_ID = "18553197483";

const OUT_FILE = path.resolve(process.cwd(), "src/data/music.generated.ts");
const API_BASE = "https://music.163.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

const CHUNK_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRIES = 3;
const CHUNK_DELAY_MS = 350;
const COVER_SIZE = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(400 * attempt);
    }
  }
  throw lastError;
}

function coverUrl(picUrl) {
  if (!picUrl) return "";
  const base = picUrl.split("?")[0].replace(/^http:\/\//, "https://");
  return `${base}?param=${COVER_SIZE}y${COVER_SIZE}`;
}

function yearOf(ms) {
  if (!ms || typeof ms !== "number") return 0;
  return new Date(ms).getFullYear();
}

/** 按歌单顺序去重专辑 */
function collectAlbums(trackIds, songsById) {
  const albums = [];
  const byAlbum = new Map();
  let missing = 0;

  for (const trackId of trackIds) {
    const song = songsById.get(trackId);
    if (!song) {
      missing += 1;
      continue;
    }
    const album = song.album;
    if (!album || album.id == null) continue;

    const track = { songId: song.id, songName: song.name ?? "" };
    const existing = byAlbum.get(album.id);
    if (existing) {
      // 同一张专辑在歌单里出现多次：曲目按歌单顺序累积，只保留第一首作为封面/入口
      existing.tracks.push(track);
      continue;
    }

    const artists = (album.artists ?? [])
      .map((a) => a.name)
      .filter(Boolean)
      .join(" / ");

    const entry = {
      albumId: album.id,
      title: album.name ?? "",
      creator: artists,
      year: yearOf(album.publishTime),
      cover: coverUrl(album.picUrl),
      // 入口落到专辑页；具体歌曲走 tracks
      songId: song.id,
      songName: song.name ?? "",
      link: `https://music.163.com/#/album?id=${album.id}`,
      tracks: [track],
    };
    byAlbum.set(album.id, entry);
    albums.push(entry);
  }

  return { albums, missing };
}

function renderModule(playlist, albums, sourceId) {
  const generatedAt = new Date().toISOString();
  return `// 本文件由 scripts/sync-netease.mjs 自动生成，请勿手改。
// 重新生成：npm run sync:music
// 来源歌单：${playlist.name}（id=${sourceId}）
// 生成时间：${generatedAt}

export interface MusicTrackGenerated {
  songId: number;
  songName: string;
}

export interface MusicAlbumGenerated {
  albumId: number;
  title: string;
  creator: string;
  year: number;
  cover: string;
  /** 歌单里第一首（兼容旧字段） */
  songId: number;
  songName: string;
  link: string;
  /** 歌单里属于这张专辑的全部曲目（按歌单顺序） */
  tracks: MusicTrackGenerated[];
}

export const MUSIC_PLAYLIST = {
  id: ${JSON.stringify(String(sourceId))},
  name: ${JSON.stringify(playlist.name ?? "")},
  url: ${JSON.stringify(`https://music.163.com/#/playlist?id=${sourceId}`)},
  cover: ${JSON.stringify(coverUrl(playlist.coverImgUrl))},
  generatedAt: ${JSON.stringify(generatedAt)},
} as const;

export const MUSIC_ALBUMS: MusicAlbumGenerated[] = ${JSON.stringify(albums, null, 2)};
`;
}

async function main() {
  const argId = process.argv[2] ?? process.env.NETEASE_PLAYLIST_ID ?? DEFAULT_PLAYLIST_ID;
  const playlistId = String(argId).trim();
  if (!/^\d+$/.test(playlistId)) fail(`歌单 ID 不合法：${argId}`);

  console.log(`→ 拉取歌单 ${playlistId} …`);
  const detail = await fetchJson(`${API_BASE}/api/v6/playlist/detail?id=${playlistId}`);
  if (detail?.code !== 200 || !detail.playlist) {
    fail(`歌单接口返回异常（code=${detail?.code}）。歌单需为公开歌单。`);
  }

  const playlist = detail.playlist;
  const trackIds = (playlist.trackIds ?? []).map((t) => t.id);
  if (trackIds.length === 0) {
    fail("歌单里没有曲目（或歌单未公开），未写入任何文件。");
  }

  console.log(
    `→ 歌单「${playlist.name}」：${playlist.trackCount ?? trackIds.length} 首曲目，开始取专辑信息 …`
  );

  const songsById = new Map();
  for (let i = 0; i < trackIds.length; i += CHUNK_SIZE) {
    const chunk = trackIds.slice(i, i + CHUNK_SIZE);
    const ids = encodeURIComponent(JSON.stringify(chunk));
    const data = await fetchJson(`${API_BASE}/api/song/detail?ids=${ids}`);
    for (const song of data?.songs ?? []) songsById.set(song.id, song);
    process.stdout.write(`  ${Math.min(i + CHUNK_SIZE, trackIds.length)}/${trackIds.length}\r`);
    if (i + CHUNK_SIZE < trackIds.length) await sleep(CHUNK_DELAY_MS);
  }
  process.stdout.write("\n");

  const { albums, missing } = collectAlbums(trackIds, songsById);
  if (albums.length === 0) fail("没有拿到任何专辑信息，未写入文件。");

  const content = renderModule(playlist, albums, playlistId);
  await writeFile(OUT_FILE, content, "utf8");

  console.log(`✓ 专辑 ${albums.length} 张（曲目 ${trackIds.length} 首）`);
  if (missing > 0) console.log(`  跳过 ${missing} 首查不到的曲目（下架/无版权）`);
  console.log(`  已写入 ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log("  下一步：git diff 看一眼，再 npm run build 验证");
}

main().catch((error) => fail(`同步失败：${error?.message ?? error}`));
