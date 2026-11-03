/**
 * treegen.js — QR 矩阵 → 体素樱花树
 *
 * 算法完全移植自 tree.icqr.com 的混淆包（webcrack 还原后逐函数对齐）。
 * 原作者的设计非常巧妙：二维码不是贴图，而是「地形高度图」——
 *   浅色模块 = 平地（泥土）
 *   深色模块 = 长出一根高度随圆心距离衰减的樱花方块柱
 * 因此俯视是二维码，斜视是樱花树。
 */

export const BLOCK = 0.0245;      // 单个方块边长
export const W = 0.46;            // 树冠半径系数（× gridSize）
export const MAX_BLOCKS = 67240;
export const MAX_SEGMENTS = 485;

export const BlockType = {
  Dirt: 0,
  CherryBlossom: 1,
  Trunk: 2,
  Grass: 3,
  FallenPetals: 4,
  Branch: 5,
};

// ── 噪声 ────────────────────────────────────────────────────────────────
function hash(x, y = 0, z = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 43.7) * 43758.5;
  return s - Math.floor(s);
}

let SEED = 0;
export function setSeed(s) { SEED = s; }
function seeded(x, y = 0, z = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 43.7 + SEED * 7919) * 43758.5;
  return s - Math.floor(s);
}

// ── 1. QR 矩阵 → 方块列表 ───────────────────────────────────────────────
/**
 * @param {boolean[][]} matrix  [row][col]
 * @returns {{data: Float32Array, count: number, gridSize: number}}
 *          data 每 4 个 float: col, row, baseY, type
 */
export function buildBlocks(matrix) {
  const N = matrix.length;
  const half = N / 2;
  const scale = N / 29;
  const trunkBlocks = Math.round(scale * 12);
  const trunkTopY = trunkBlocks * BLOCK;
  const canopyR = N * W;
  const canopyR2 = canopyR * canopyR;
  const canopyBlocks = Math.round(scale * 18);

  const data = new Float32Array(MAX_BLOCKS * 4);
  let n = 0;
  const push = (col, row, y, type) => {
    if (n >= MAX_BLOCKS) return;
    const o = n * 4;
    data[o] = col;
    data[o + 1] = row;
    data[o + 2] = y;
    data[o + 3] = type;
    n++;
  };

  for (let row = 0; row < N; row++) {
    // 注意：屏幕 y = +z，若直接用 row 会得到上下镜像的二维码（不可扫）。
    // 因此把行坐标翻转，保证俯视时二维码方向正确。
    const zr = N - 1 - row;
    for (let col = 0; col < N; col++) {
      const dark = matrix[row][col];
      const dx = col - half;
      const dy = row - half;
      const d2 = dx * dx + dy * dy;

      // 地面层 = 二维码本体
      push(col, zr, 0, dark
        ? (d2 < 6.25 ? BlockType.CherryBlossom
          : d2 >= canopyR2 ? BlockType.Grass
            : BlockType.FallenPetals)
        : BlockType.Dirt);

      if (!dark) continue;

      // 树干：中心 5×5
      if (d2 < 6.25) {
        for (let i = 1; i < trunkBlocks; i++) {
          push(col, zr, i * BLOCK, BlockType.Trunk);
        }
      }

      // 树冠：深色模块向上长柱子，高度按穹顶剖面
      if (d2 < canopyR2) {
        const t = 1 - Math.sqrt(d2) / canopyR;
        const h = Math.max(4, Math.round(canopyBlocks * (0.25 + t * 0.75 * t)));
        const lift = Math.floor(t * 4.5 * scale) * BLOCK;

        for (let i = 0; i < h; i++) {
          push(col, zr, trunkTopY + i * BLOCK + lift, BlockType.CherryBlossom);
        }
        const extra = Math.floor(hash(col, row, 500) * 2.5 * scale);
        for (let i = 0; i < extra; i++) {
          push(col, zr, trunkTopY + (h + i) * BLOCK + lift, BlockType.CherryBlossom);
        }
        if (d2 < 2.25) {
          for (let i = 0; i < 4; i++) {
            push(col, zr, trunkTopY + i * BLOCK, BlockType.CherryBlossom);
          }
        }
      }
    }
  }

  return { data, count: n, gridSize: N, trunkTopY, canopyR, scale };
}

// ── 2. 统计量（驱动树枝形态）────────────────────────────────────────────
export function computeStats(matrix) {
  const N = matrix.length;
  let dark = 0;
  let edges = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) dark++;
      if (c > 0 && matrix[r][c] !== matrix[r][c - 1]) edges++;
      if (r > 0 && matrix[r][c] !== matrix[r - 1][c]) edges++;
    }
  }
  const density = dark / (N * N);
  const edgeRatio = edges / (N * 2 * (N - 1));
  const scale = N / 29;
  return {
    gridSize: N,
    density,
    edgeRatio,
    trunkHeight: (0.26 + density * 0.08) * scale,
    trunkRadius: (0.024 + density * 0.008) * scale,
    trunkLean: (0.04 + hash(density, edgeRatio) * 0.03) * scale,
    mainBranches: 4 + Math.floor(density * 4),
    branchSpread: 0.5 + edgeRatio * 0.5,
    branchLengthScale: 0.55 + density * 0.25,
    maxDepth: edgeRatio > 0.28 ? 5 : 4,
    canopyDensity: 0.5 + density * 0.5,
  };
}

// ── 3. 树枝（锥形圆柱段）────────────────────────────────────────────────
/**
 * @returns {{segments: Float32Array, segmentCount: number, tips: Array}}
 *          segments 每段 12 个 float:
 *          ax,ay,az,ar, bx,by,bz,br, depth, seed, 0, 0
 */
export function buildBranches(stats, gridSize) {
  const canopyR = gridSize * W * BLOCK;
  const segs = [];
  const tips = [];
  let count = 0;

  const pushSeg = (ax, ay, az, ar, bx, by, bz, br, depth, seed) => {
    if (count >= MAX_SEGMENTS) return;
    segs.push(ax, ay, az, ar, bx, by, bz, br, depth, seed, 0, 0);
    count++;
  };

  const { trunkHeight, trunkLean, mainBranches } = stats;
  // 视觉调整：加粗树干，让它在花团下依然清晰可见
  const trunkRadius = stats.trunkRadius * 1.15;   // 根部靠 flare 加粗，中段保持纤细

  // 树干：10 段，带弯曲与锥度
  for (let i = 0; i < 10; i++) {
    const t0 = i / 10;
    const t1 = (i + 1) / 10;
    // 根部外扩（像真正长在地里的树），并向树冠收分
    const flare0 = 1 + Math.pow(Math.max(0, 1 - t0 / 0.26), 1.6) * 1.3;
    const flare1 = 1 + Math.pow(Math.max(0, 1 - t1 / 0.26), 1.6) * 1.3;
    const r0 = trunkRadius * (1 - t0 * 0.62) * (1 + Math.sin(t0 * Math.PI * 0.8) * 0.08) * flare0;
    const r1 = trunkRadius * (1 - t1 * 0.62) * (1 + Math.sin(t1 * Math.PI * 0.8) * 0.08) * flare1;
    const x0 = trunkLean * t0 * t0 + trunkLean * 0.3 * Math.sin(t0 * Math.PI * 1.5);
    const z0 = trunkLean * 0.5 * Math.sin(t0 * Math.PI * 0.8);
    const x1 = trunkLean * t1 * t1 + trunkLean * 0.3 * Math.sin(t1 * Math.PI * 1.5);
    const z1 = trunkLean * 0.5 * Math.sin(t1 * Math.PI * 0.8);
    pushSeg(x0, t0 * trunkHeight, z0, r0, x1, t1 * trunkHeight, z1, r1, 0, t0 * 0.5);
  }

  const trunkPoint = (t) => ({
    x: trunkLean * t * t + trunkLean * 0.3 * Math.sin(t * Math.PI * 1.5),
    y: trunkHeight * t,
    z: trunkLean * 0.5 * Math.sin(t * Math.PI * 0.8),
  });

  // ── 中央主干（领导枝）：从树干顶继续向上，穿出花冠，树顶可见 ──
  const leaderBase = trunkPoint(1.0);
  const leaderTopY = trunkHeight + canopyR * 1.18;
  const LEADER_SEGS = 7;
  for (let i = 0; i < LEADER_SEGS; i++) {
    const u0 = i / LEADER_SEGS;
    const u1 = (i + 1) / LEADER_SEGS;
    const b0 = Math.sin(u0 * Math.PI * 0.9) * trunkLean * 0.8;
    const b1 = Math.sin(u1 * Math.PI * 0.9) * trunkLean * 0.8;
    const r0 = Math.max(trunkRadius * (0.50 - 0.44 * u0), trunkRadius * 0.05);
    const r1 = Math.max(trunkRadius * (0.50 - 0.44 * u1), trunkRadius * 0.04);
    pushSeg(
      leaderBase.x + b0, trunkHeight + (leaderTopY - trunkHeight) * u0, leaderBase.z,
      r0,
      leaderBase.x + b1, trunkHeight + (leaderTopY - trunkHeight) * u1, leaderBase.z,
      r1, 0, u0,
    );
  }

  // ── 只保留 4~5 根主枝，不再递归分叉 ──
  const limbCount = Math.min(5, Math.max(4, mainBranches));
  for (let i = 0; i < limbCount; i++) {
    const start = trunkPoint(0.86 + seeded(i, 0, 1200) * 0.26);
    const ang = (i / limbCount) * Math.PI * 2 + (seeded(i, 0, 900) - 0.5) * 0.5;
    const len = canopyR * (0.62 + seeded(i, 0, 1000) * 0.30);
    const targetY = trunkHeight * (0.95 + seeded(i, 0, 1050) * 0.40);
    const tx = Math.cos(ang) * len;
    const tz = Math.sin(ang) * len;

    let px = start.x, py = start.y, pz = start.z;
    let pr = trunkRadius * (0.46 + seeded(i, 0, 1100) * 0.16);
    for (let k = 0; k < 3 && count < 470; k++) {
      const u = (k + 1) / 3;
      const arc = Math.sin(u * Math.PI) * canopyR * 0.18;
      const nx = start.x + (tx - start.x) * u + (seeded(i, k, 150) - 0.5) * 0.012;
      const ny = start.y + (targetY - start.y) * u + arc * (1 - u);
      const nz = start.z + (tz - start.z) * u + (seeded(i, k, 250) - 0.5) * 0.012;
      const nr = pr * (0.62 + seeded(i, k, 350) * 0.10);
      pushSeg(px, py, pz, pr, nx, ny, nz, nr, 1, seeded(i, k, 400));
      px = nx; py = ny; pz = nz; pr = nr;
    }
    tips.push({ x: px, y: py, z: pz, radius: pr * 30 });
  }

  return { segments: new Float32Array(segs), segmentCount: count, tips };
}

// ── 4. 花 ───────────────────────────────────────────────────────────────
const CANOPY_LIFT = 0.055;
/** 树冠穹顶表面高度（世界单位）：给定到轴心的水平距离（模块数），返回平滑表面高度 */
export function canopySurfaceY(dModules, gridSize) {
  const scale = gridSize / 29;
  const canopyR = gridSize * W;
  const trunkTopY = Math.round(scale * 12) * BLOCK;
  const canopyBlocks = Math.round(scale * 18);
  const t = Math.max(0, 1 - dModules / canopyR);
  const h = Math.max(4, Math.round(canopyBlocks * (0.25 + 0.75 * t * t)));
  const lift = Math.floor(t * 4.5 * scale) * BLOCK;
  return trunkTopY + h * BLOCK + lift + CANOPY_LIFT;
}
   // 花簇抬高量（世界单位）：只影响 3D 视角可读性，平铺模式看不到花

const halfGridOf = (gridSize) => gridSize * BLOCK * 0.5;
const toCell = (x, gridSize) => (x + halfGridOf(gridSize)) / BLOCK;

/** 枝梢花簇：每个枝梢一簇球状分布的花 */
export function buildTipFlowers(tips, stats) {
  const gridSize = stats.gridSize;
  const out = [];
  const half = halfGridOf(gridSize);
  const canopyR = gridSize * W;
  for (let i = 0; i < tips.length; i++) {
    const tip = tips[i];
    if (seeded(i, 0, 780) < 0.01) continue;
    const dist = Math.sqrt(tip.x * tip.x + tip.z * tip.z);
    const boost = 1 + (1 - Math.min(1, dist / (half * W))) * 0.45;
    const jitter = (1 + seeded(i, 3, 790) * 0.3) * boost;
    // 顶部花簇收紧：越高越贴合冠形，避免顶端散成一把碎花
    const topness = Math.max(0, Math.min(1, (tip.y - stats.trunkHeight * 1.2) / (canopyR * BLOCK * 1.7)));
    const tighten = 1 - topness * 0.45;
    const n = Math.max(22, Math.floor(tip.radius * 38 * stats.canopyDensity * jitter * (1 + topness * 0.35)));
    const radius = tip.radius * BLOCK * 9 * jitter * tighten;

    for (let k = 0; k < n; k++) {
      const r = radius * Math.cbrt(seeded(i, k, 830));
      const a = seeded(i, k, 810) * Math.PI * 2;
      const z = seeded(i, k, 820) * 2 - 1;
      const rr = Math.sqrt(1 - z * z);
      const x = tip.x + r * rr * Math.cos(a) * 1.5;
      const zz = tip.z + r * rr * Math.sin(a) * 1.5;
      let y = tip.y + r * z * 1.1 + radius * 0.1 + CANOPY_LIFT;
      // 软下限：低于树干顶的花被压扁，而不是硬切出一条平底（硬切会让树冠像蘑菇帽）
      const floorY = stats.trunkHeight * 0.98;
      if (y < floorY) y = floorY - (floorY - y) * 0.22;
      // 上限：不得超过该半径处的穹顶表面，避免树顶散出孤立花簇
      const dMod = Math.sqrt(x * x + zz * zz) / BLOCK;
      const ceilY = canopySurfaceY(dMod, gridSize) + 0.006;
      if (y > ceilY) y = ceilY - (y - ceilY) * 0.15;
      out.push(toCell(x, gridSize), toCell(zz, gridSize), y, seeded(i, k, 800));
    }
    // 枝梢下方悬挂的几朵
    const hang = 6 + Math.floor(seeded(i, 0, 1500) * 6);
    for (let k = 0; k < hang; k++) {
      const a = seeded(i, k, 1700) * Math.PI * 2;
      const x = tip.x + Math.cos(a) * radius * 0.5;
      const z = tip.z + Math.sin(a) * radius * 0.5;
      let y = tip.y - BLOCK * (0.5 + seeded(i, k, 1900) * 2) + CANOPY_LIFT;
      const floorY2 = stats.trunkHeight * 0.98;
      if (y < floorY2) y = floorY2 - (floorY2 - y) * 0.22;
      out.push(toCell(x, gridSize), toCell(z, gridSize), y, seeded(i, k, 1600));
    }
    if (seeded(i, 2, 900) < 0.5) {
      const a = seeded(i, 0, 920) * Math.PI * 2;
      const x = tip.x + Math.cos(a) * radius * 0.4;
      const z = tip.z + Math.sin(a) * radius * 0.4;
      out.push(toCell(x, gridSize), toCell(z, gridSize), tip.y - 0.01225, seeded(i, 0, 910) + 1);
    }
  }
  void canopyR;
  return { data: new Float32Array(out), count: out.length / 4 };
}

/** 树冠花：每个深色模块柱顶的几朵 */
export function buildCanopyFlowers(matrix) {
  const N = matrix.length;
  const half = N / 2;
  const scale = N / 29;
  const trunkTopY = Math.round(scale * 12) * BLOCK;
  const canopyR = N * W;
  const canopyR2 = canopyR * canopyR;
  const out = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const dx = col - half;
      const dy = row - half;
      const d2 = dx * dx + dy * dy;
      if (!(d2 < canopyR2 && d2 >= 6.25)) continue;
      const t = 1 - Math.sqrt(d2) / canopyR;
      const h = Math.max(4, Math.round(Math.round(scale * 18) * (0.25 + t * 0.75 * t)));
      const lift = Math.floor(t * 4.5 * scale) * BLOCK;
      const topY = trunkTopY + (h - 1) * BLOCK + lift + BLOCK;
      // 顶部柱更高 → 花更密，让穹顶收成一个实心冠而不是碎点
      const n = 2 + Math.floor(hash(col, row, 600) * 3);
      for (let k = 0; k < n; k++) {
        out.push(
          col + (hash(col, row, 800 + k) - 0.5) * 0.95,
          (N - 1 - row) + (hash(col, row, 900 + k) - 0.5) * 0.95,
          topY + (hash(col, row, 1000 + k) - 0.55) * BLOCK * 2.4 + CANOPY_LIFT,
          hash(col, row, 777 + k),
        );
      }
      if (hash(col, row, 1100) < 0.35) {
        out.push(
          col + (hash(col, row, 1300) - 0.5) * 0.5,
          (N - 1 - row) + (hash(col, row, 1400) - 0.5) * 0.5,
          topY - BLOCK,
          hash(col, row, 1200) + 1,
        );
      }
    }
  }
  return { data: new Float32Array(out), count: out.length / 4 };
}

/** 悬浮花瓣：树冠外深色模块上方 */
export function buildOuterPetals(gridSize, matrix) {
  const N = matrix.length;
  const half = N / 2;
  const canopyR = N * W;
  const canopyR2 = canopyR * canopyR;
  const out = [];
  let n = 0;
  for (let row = 0; row < N && n < 50000; row++) {
    for (let col = 0; col < N && n < 50000; col++) {
      const dx = col - half;
      const dy = row - half;
      const d2 = dx * dx + dy * dy;
      if (d2 < 25) continue;
      if (!matrix[row][col]) continue;
      if (d2 < canopyR2) continue;
      const count = 2 + Math.floor(hash(col, row, 5100) * 3);
      for (let k = 0; k < count && n < 50000; k++) {
        out.push(
          col + (hash(col, row, 5300 + k) - 0.5) * 0.85,
          (N - 1 - row) + (hash(col, row, 5400 + k) - 0.5) * 0.85,
          0.06 + hash(col, row, 5200 + k) * 0.40,
          BLOCK * (0.5 + hash(col, row, 5500 + k) * 1.2),
        );
        n++;
      }
    }
  }
  void gridSize;
  return { data: new Float32Array(out), count: n };
}

/** 落叶：从树冠范围内飘落（下落动画在着色器里按时间计算） */
export function buildFallingLeaves(gridSize, count = 90) {
  const half = gridSize * BLOCK * 0.5;
  const canopyR = gridSize * W * BLOCK;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = seeded(i, 0, 5000) * Math.PI * 2;
    const r = Math.sqrt(seeded(i, 0, 5100)) * canopyR * 0.95;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // 起始高度：树冠下缘到中上部
    const startY = 0.26 + seeded(i, 0, 5200) * 0.30;
    out.push((x + half) / BLOCK, (z + half) / BLOCK, startY, seeded(i, 0, 5300));
  }
  return { data: new Float32Array(out), count };
}

/** 环境花瓣：全场漂浮 */
export function buildAmbientPetals(gridSize) {
  const span = gridSize * 1.0;
  const off = (span - gridSize) * 0.5;
  const N = 140;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4] = seeded(i, 0, 8000) * span - off;
    data[i * 4 + 1] = seeded(i, 0, 8100) * span - off;
    data[i * 4 + 2] = 0.05 + seeded(i, 0, 8200) * 0.42;
    data[i * 4 + 3] = seeded(i, 0, 8300);
  }
  return { data, count: N };
}

/** 秋雨：10 根雨丝 */
export function buildRain(gridSize) {
  const data = new Float32Array(40);
  const canopyR = gridSize * 0.46;
  for (let i = 0; i < 10; i++) {
    data[i * 4] = canopyR * (0.35 + seeded(i, 0, 9000) * 0.55);
    data[i * 4 + 1] = 0.25 + seeded(i, 0, 9100) * 0.3;
    data[i * 4 + 2] = 4 + seeded(i, 0, 9200) * 9;
    data[i * 4 + 3] = seeded(i, 0, 9300);
  }
  return { data, count: 10 };
}
