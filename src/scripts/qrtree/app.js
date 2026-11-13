/**
 * 二维码树 —— 交互与主循环
 * 移植自 tree.icqr.com 的逆向实现，配色/排版改为本站编辑风（paper #F9F8F6 / ink #1C1C1C / accent #A63A2B）。
 */
import { Renderer } from './renderer.js';
import {
  buildBlocks, computeStats, buildBranches, buildTipFlowers,
  buildCanopyFlowers, buildFallingLeaves, setSeed,
} from './treegen.js';
import qrcode from './qrcode-generator.js';

const DEFAULT_URL = 'https://icqr.com/';
const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 分享参数：season + url → base64url（与原站同构，便于互通）──────────
function encodeShare(url, season) {
  const raw = String(season) + '0' + url;
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShare(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const text = new TextDecoder().decode(bytes);
    if (text.length < 3) return null;
    return {
      season: Math.max(0, Math.min(2, Number(text[0]) || 0)),
      url: text.slice(2),
    };
  } catch {
    return null;
  }
}

// 由链接 + 季节派生固定 seed：同一个链接永远长同一棵树
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h >>> 0) % 99990) / 99990;
}

function makeMatrix(text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text || DEFAULT_URL);
    qr.make();
    const n = qr.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  } catch {
    return text === DEFAULT_URL ? [] : makeMatrix(DEFAULT_URL);
  }
}

export function mountTree(root, opts = {}) {
  const canvas = root.querySelector('[data-qrtree-canvas]');
  const input = root.querySelector('[data-qrtree-url]');
  const hint = root.querySelector('[data-qrtree-hint]');
  const seasons = [...root.querySelectorAll('[data-qrtree-season]')];
  const copyBtn = root.querySelector('[data-qrtree-copy]');
  const saveBtn = root.querySelector('[data-qrtree-save]');
  const reduced = REDUCED();

  const params = new URLSearchParams(location.search);
  const shared = decodeShare(params.get('q') || '');
  const sharedUrl = params.get('u');   // /tree/?u=https://... 直接指定链接（友链/社交入口用）

  const state = {
    url: opts.url?.trim() || sharedUrl?.trim() || shared?.url?.trim() || DEFAULT_URL,
    season: opts.season ?? shared?.season ?? 0,
    isFlat: false,
    progress: 0,
    flatCur: 0,
    time: 0,
    bobX: 0,
    bobY: 0,
    rain: 0,
    zoom: opts.zoom ?? 1,
    shiftY: opts.shiftY ?? 0,
    custom: [0, 0, 0, 0],
    trunkSeed: 0,
    gridSize: 29,
  };

  state.trunkSeed = hashSeed(state.url + ':' + state.season);

  let renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (err) {
    console.error(err);
    root.classList.add('is-unsupported');
    return { destroy() {} };
  }

  // ── 构建树 ──
  function rebuild() {
    const matrix = makeMatrix(state.url);
    const blocks = buildBlocks(matrix);
    const stats = computeStats(matrix);
    setSeed(Math.floor(state.trunkSeed * 99990) + 1);
    const branches = buildBranches(stats, blocks.gridSize);
    const tips = buildTipFlowers(branches.tips, stats);
    const canopy = buildCanopyFlowers(matrix);

    // 落叶与树上的花用同一套网格，只是多了一段下落动画（kind=1）
    const leaves = buildFallingLeaves(blocks.gridSize, reduced ? 0 : 90);

    const flowerCount = tips.count + canopy.count + leaves.count;
    const flowers = new Float32Array(flowerCount * 4);
    const kinds = new Float32Array(flowerCount);
    flowers.set(tips.data.subarray(0, tips.count * 4), 0);
    flowers.set(canopy.data.subarray(0, canopy.count * 4), tips.count * 4);
    const leafOffset = tips.count + canopy.count;
    flowers.set(leaves.data.subarray(0, leaves.count * 4), leafOffset * 4);
    kinds.fill(1, leafOffset);

    state.gridSize = blocks.gridSize;
    renderer.setBlocks(blocks);
    renderer.setBranches(branches);
    renderer.setFlowers({ data: flowers, count: flowerCount, kinds });
  }

  // ── 重建交叉淡化 ──
  // 换季 / 换链接是一帧内换掉整棵几何体，直接重建会硬 pop。
  // 先让画布 opacity 降到 0.35（140ms），在最低点重建，再 220ms 回到 1。
  const FADE_OUT_MS = 140;
  const FADE_IN_MS = 220;
  let fadeTimer = 0;

  function rebuildCrossfade() {
    if (reduced) {
      rebuild();
      return;
    }
    window.clearTimeout(fadeTimer);
    canvas.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
    canvas.style.opacity = '0.35';
    fadeTimer = window.setTimeout(() => {
      rebuild();
      // 统一用透明度来实现纸色交叉淡化：中段 0.35 时地面与纸底混色，
      // 几何体在这时替换，肉眼不易察觉整棵树被换掉。
      canvas.style.transition = `opacity ${FADE_IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      requestAnimationFrame(() => {
        canvas.style.opacity = '1';
      });
    }, FADE_OUT_MS);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  }

  const ro = new ResizeObserver(() => {
    resize();
    // 画布尺寸变化后要重绘一帧（reduced-motion 下循环可能已停）；
    // 不挂在 resize() 里：初始化时 resize() 先于主循环的 raf 声明执行
    kickFrame();
  });
  ro.observe(canvas);
  resize();
  rebuild();

  // ── 主循环 ──
  let raf = 0;
  let last = 0;
  let paused = false;
  let burst = -1;
  let rainCur = 0;

  // reduced-motion 下场景落定后帧循环会停，任何状态变更后用它重新拉起；
  // 正常模式下循环常驻，此时调用是无害的空操作
  function kickFrame() {
    if (raf === 0 && !paused) raf = requestAnimationFrame(frame);
  }

  function frame(ts) {
    if (paused) { raf = 0; return; }
    const now = ts / 1000;
    if (!last) last = now;
    const dt = Math.min(now - last, 0.05);
    last = now;
    if (!reduced) state.time += dt;

    const target = state.isFlat ? 1 : 0;
    state.flatCur += (target - state.flatCur) * Math.min(1, dt * 3.5);
    if (Math.abs(state.flatCur - target) < 0.001) state.flatCur = target;
    const c = state.flatCur;
    state.progress = c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;

    const inv = 1 - state.progress;
    const since = state.time - burst;
    const kick = burst >= 0 ? Math.exp(-since * 6) * Math.sin(since * 12) * 0.008 : 0;
    state.bobX = reduced ? 0 : Math.sin(state.time * 0.15) * 0.003 * inv;
    state.bobY = reduced ? 0 : Math.sin(state.time * 0.11 + 1) * 0.002 * inv + kick;

    const rainTarget = state.season === 2 ? 1 : 0;
    rainCur += (rainTarget - rainCur) * Math.min(1, dt * 3);
    if (Math.abs(rainCur - rainTarget) < 0.001) rainCur = rainTarget;
    state.rain = rainCur;

    renderer.render(state);
    if (!reduced) {
      raf = requestAnimationFrame(frame);
    } else {
      // reduced-motion：压平、落雨过渡与点击抖动全部落定后停帧，不再空转
      const settled =
        Math.abs(state.flatCur - (state.isFlat ? 1 : 0)) < 0.001 &&
        Math.abs(rainCur - (state.season === 2 ? 1 : 0)) < 0.001 &&
        (burst < 0 || reduced || state.time - burst > 1.2);
      raf = settled ? 0 : requestAnimationFrame(frame);
    }
  }
  raf = requestAnimationFrame(frame);

  // ── 交互 ──
  function syncUI() {
    seasons.forEach((b) => {
      const on = Number(b.dataset.qrtreeSeason) === state.season;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-active', on);
    });
    if (hint) hint.textContent = state.isFlat ? '点击返回树' : '点击画面查看二维码';
    // 俯视时可以让宿主关掉底部渐隐（那层渐变会洗淡二维码下缘）
    root.classList.toggle('is-flat', state.isFlat);
    if (opts.updateHistory === false) return;
    const q = encodeShare(state.url, state.season);
    history.replaceState(null, '', location.pathname + '?q=' + q);
  }

  function setSeason(s) {
    state.season = Math.max(0, Math.min(2, s));
    state.trunkSeed = hashSeed(state.url + ':' + state.season);
    rebuildCrossfade();
    syncUI();
    kickFrame(); // 换季有落雨淡入淡出，停帧时重新拉起
  }

  function setUrl(url) {
    state.url = url;
    state.trunkSeed = hashSeed(state.url + ':' + state.season);
    if (input) input.value = url;
    rebuildCrossfade();
    syncUI();
    kickFrame(); // 重建后的新几何体至少要画一帧
  }

  function toggleFlat() {
    state.isFlat = !state.isFlat;
    burst = state.time;
    syncUI();
    kickFrame(); // 压平/立起是渐进动画，停帧时重新拉起
  }

  // 非法链接：先摘掉标记再重挂，连续出错也能重播一次轻抖（color 过渡见 tree.astro）
  let invalidTimer = 0;
  function flagInvalid() {
    window.clearTimeout(invalidTimer);
    root.classList.remove('is-invalid');
    void root.offsetWidth;
    root.classList.add('is-invalid');
    invalidTimer = window.setTimeout(() => root.classList.remove('is-invalid'), 1200);
  }

  function applyUrl(text) {
    const t = (text || '').trim();
    if (!t) return;
    try {
      const u = new URL(t);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
      if (!/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(u.hostname)) throw new Error('host');
    } catch {
      flagInvalid();
      return;
    }
    const probe = makeMatrix(t);
    if (!probe.length || probe.length > 41) {
      flagInvalid();
      return;
    }
    state.url = t;
    rebuildCrossfade();
    kickFrame(); // 换树后至少重绘一帧（reduced-motion 下立即重建、循环可能已停）
  }

  const onCanvasClick = () => toggleFlat();
  canvas.addEventListener('click', onCanvasClick);

  const onSeasonClick = (e) => setSeason(Number(e.currentTarget.dataset.qrtreeSeason));
  seasons.forEach((b) => b.addEventListener('click', onSeasonClick));

  const onInputKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyUrl(input.value);
      input.blur();
    }
  };
  const onInputBlur = () => applyUrl(input.value);
  input?.addEventListener('keydown', onInputKey);
  input?.addEventListener('blur', onInputBlur);

  const onCopy = async () => {
    const link = location.origin + location.pathname + '?q=' + encodeShare(state.url, state.season);
    try {
      await navigator.clipboard.writeText(link);
      flash(copyBtn, '已复制');
    } catch {
      flash(copyBtn, '复制失败');
    }
  };
  copyBtn?.addEventListener('click', onCopy);

  const onSave = () => {
    const prevFlat = state.isFlat;
    const prevCur = state.flatCur;
    const prevProgress = state.progress;
    state.isFlat = true;
    state.flatCur = 1;
    state.progress = 1;
    renderer.render(state);
    const url = renderer.toDataURL();
    state.isFlat = prevFlat;
    state.flatCur = prevCur;
    state.progress = prevProgress;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrtree.png';
    a.click();
    flash(saveBtn, '已保存');
  };
  saveBtn?.addEventListener('click', onSave);

  function flash(el, text) {
    if (!el) return;
    const old = el.textContent;
    el.textContent = text;
    el.dataset.flash = '1';
    setTimeout(() => {
      el.textContent = old;
      delete el.dataset.flash;
    }, 1400);
  }

  // 调试钩子（无头测试用；不影响正常交互）
  window.__qrtree = { state, renderer, rebuild };

  if (input) input.value = state.url;
  syncUI();

  function pause() {
    paused = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function resume() {
    if (!paused) return;
    paused = false;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  return {
    state,
    setUrl,
    setSeason,
    pause,
    resume,
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(invalidTimer);
      ro.disconnect();
      canvas.removeEventListener('click', onCanvasClick);
      seasons.forEach((b) => b.removeEventListener('click', onSeasonClick));
      input?.removeEventListener('keydown', onInputKey);
      input?.removeEventListener('blur', onInputBlur);
      copyBtn?.removeEventListener('click', onCopy);
      saveBtn?.removeEventListener('click', onSave);
      renderer?.dispose?.();
    },
  };
}

// ── 挂载（兼容 View Transitions）────────────────────────────────────────
let mounted = null;

function boot() {
  const root = document.querySelector('[data-qrtree]');
  if (!root) return;
  if (mounted && mounted.root === root) return;
  mounted?.instance?.destroy?.();
  mounted = { root, instance: mountTree(root) };
}

document.addEventListener('astro:page-load', boot);
document.addEventListener('astro:before-swap', () => {
  mounted?.instance?.destroy?.();
  mounted = null;
});
boot();
