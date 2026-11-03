/**
 * shaders.js — GLSL ES 3.00 着色器
 * 移植自原站 WGSL（见 REVERSE_ENGINEERING.md 第 4/5 节）
 */

const COMMON = `#version 300 es
precision highp float;

uniform float uProgress;   // 0 = 3D 树, 1 = 俯视二维码
uniform float uTime;
uniform float uGrid;
uniform vec2  uRes;
uniform float uBobX;
uniform float uBobY;
uniform float uSeason;     // 0 春 / 1 夏 / 2 秋
uniform vec3  uCustom;     // 自定义花色
uniform float uCustomStrength;
uniform float uRain;
uniform float uTrunkSeed;
uniform float uDebug;
// 宿主可以要求 3D 视角整体缩小 / 上移一点（弹窗里给树留出上下空气）；俯视时还原
uniform float uZoom;
uniform float uShiftY;

const float BLOCK = 0.0245;
const float W = 0.46;

vec4 projectIso(vec3 p) {
  // 3D 视角把树"拉高"一点（俯视二维码时还原），让比例更像树而不是矮蘑菇
  p.y *= mix(1.10, 1.0, uProgress);
  float isoY = mix(0.78, 0.0, uProgress) + uBobX;
  float isoX = mix(-0.55, -1.5707963, uProgress) + uBobY;
  float cy = cos(isoY), sy = sin(isoY);
  float cx = cos(isoX), sx = sin(isoX);

  float ry_x = p.x * cy - p.z * sy;
  float ry_z = p.x * sy + p.z * cy;
  float rx_y = p.y * cx - ry_z * sx;
  float rx_z = p.y * sx + ry_z * cx;

  float aspect = uRes.x / uRes.y;
  float portrait = aspect < 0.8 ? 1.2 : 1.0;
  // 画布越宽，3D 视角可以放得越大（俯视二维码时还原，避免溢出）
  float wideBoost = mix(1.0, 1.20, smoothstep(1.30, 2.10, aspect));
  float viewScale = (mix(57.0, 46.4, uProgress) / uGrid) * portrait * mix(wideBoost, 1.0, uProgress) * mix(uZoom, 1.0, uProgress);
  float scaleX = viewScale / max(aspect, 1.0);
  float scaleY = viewScale / max(1.0 / aspect, 1.0);

  float yOff = mix(-0.28, 0.08, uProgress) + uShiftY * (1.0 - uProgress);
  float xOff = mix(0.0, 0.015, uProgress);

  return vec4((ry_x + xOff) * scaleX, (rx_y + yOff) * scaleY, rx_z * 0.02, 1.0);
}

vec3 acesFilm(vec3 x) {
  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 finish(vec3 hdr) {
  hdr = acesFilm(hdr * 1.15);
  hdr = pow(max(hdr, 0.0), vec3(1.0 / 2.2));
  float g = dot(hdr, vec3(0.299, 0.587, 0.114));
  return mix(vec3(g), hdr, 1.25);
}

// 花/花瓣使用更饱和的 tonemap（原站：aces*1.05 + 饱和度 1.9）
vec3 finishFlower(vec3 hdr) {
  hdr = acesFilm(hdr * 1.05);
  hdr = pow(max(hdr, 0.0), vec3(1.0 / 2.2));
  float g = dot(hdr, vec3(0.299, 0.587, 0.114));
  return mix(vec3(g), hdr, 1.9);
}

const vec3 SUN_DIR = vec3(-0.405616, 0.861934, -0.304212);
const vec3 SUN_COL = vec3(1.20, 1.20, 1.20);
const vec3 AMBIENT = vec3(0.28, 0.28, 0.30);
const vec3 SKY_FILL = vec3(0.90, 0.85, 0.95);
const vec3 BOUNCE  = vec3(0.55, 0.60, 0.50);
`;

// ─────────────────────────────────────────────────────────────────────────
// 方块（体素）
// ─────────────────────────────────────────────────────────────────────────
export const BLOCK_VS = COMMON + `
layout(location = 0) in vec4 aBlock;   // col, row, baseY, type

out vec3  vNormal;
out vec2  vUV;
out float vType;
out float vLayer;
out vec2  vCell;
out float vH;

void main() {
  int vi = gl_VertexID;
  int faceIdx = vi / 6;
  int vertIdx = vi % 6;

  vec2 qv;
  if      (vertIdx == 0) qv = vec2(0.0, 0.0);
  else if (vertIdx == 1) qv = vec2(1.0, 0.0);
  else if (vertIdx == 2) qv = vec2(0.0, 1.0);
  else if (vertIdx == 3) qv = vec2(0.0, 1.0);
  else if (vertIdx == 4) qv = vec2(1.0, 0.0);
  else                   qv = vec2(1.0, 1.0);

  float col = aBlock.x;
  float row = aBlock.y;
  float baseY = aBlock.z;
  int typePacked = int(aBlock.w + 0.5);

  float cubeSize = BLOCK;
  float halfGrid = uGrid * cubeSize * 0.5;
  float baseX = col * cubeSize - halfGrid;
  float baseZ = row * cubeSize - halfGrid;
  float h = cubeSize;
  float hw = cubeSize * 0.5;
  float hd = cubeSize * 0.5;

  vec3 localPos;
  vec3 normal;

  if (faceIdx == 0) {        // +Y
    localPos = vec3(baseX + (qv.x - 0.5) * cubeSize, baseY + h, baseZ + (qv.y - 0.5) * cubeSize);
    normal = vec3(0.0, 1.0, 0.0);
  } else if (faceIdx == 1) { // -Y
    localPos = vec3(baseX + (qv.x - 0.5) * cubeSize, baseY, baseZ + (0.5 - qv.y) * cubeSize);
    normal = vec3(0.0, -1.0, 0.0);
  } else if (faceIdx == 2) { // +Z
    localPos = vec3(baseX + (qv.x - 0.5) * cubeSize, baseY + qv.y * h, baseZ + hd);
    normal = vec3(0.0, 0.0, 1.0);
  } else if (faceIdx == 3) { // -Z
    localPos = vec3(baseX + (0.5 - qv.x) * cubeSize, baseY + qv.y * h, baseZ - hd);
    normal = vec3(0.0, 0.0, -1.0);
  } else if (faceIdx == 4) { // +X
    localPos = vec3(baseX + hw, baseY + qv.y * h, baseZ + (qv.x - 0.5) * cubeSize);
    normal = vec3(1.0, 0.0, 0.0);
  } else {                   // -X
    localPos = vec3(baseX - hw, baseY + qv.y * h, baseZ + (0.5 - qv.x) * cubeSize);
    normal = vec3(-1.0, 0.0, 0.0);
  }

  vUV = qv;
  vNormal = normal;
  vType = float(typePacked);
  vLayer = baseY / BLOCK;
  vCell = vec2(col, row);
  vH = h;

  // ── 塌缩：平铺模式下树干/树冠收缩到基座 ──
  if (typePacked == 2 && baseY > 0.001) {
    float trunkVis = smoothstep(0.2, 0.6, uProgress);
    localPos = vec3(
      baseX + (localPos.x - baseX) * trunkVis,
      baseY + (localPos.y - baseY) * trunkVis,
      baseZ + (localPos.z - baseZ) * trunkVis
    );
  }
  if (typePacked == 1) {
    float cubeVis = smoothstep(0.15, 0.6, uProgress);
    localPos = vec3(
      baseX + (localPos.x - baseX) * cubeVis,
      baseY + (localPos.y - baseY) * cubeVis,
      baseZ + (localPos.z - baseZ) * cubeVis
    );
  }

  gl_Position = projectIso(localPos);
}
`;

export const BLOCK_FS = COMMON + `
in vec3  vNormal;
in vec2  vUV;
in float vType;
in float vLayer;
in vec2  vCell;
in float vH;

out vec4 outColor;

void main() {
  if (uDebug > 0.5) {
    int t = int(vType + 0.5);
    vec3 c = vec3(0.5);
    if (t == 0) c = vec3(0.30, 0.30, 0.32);
    else if (t == 1) c = vec3(1.0, 0.35, 0.55);
    else if (t == 2) c = vec3(0.55, 0.30, 0.10);
    else if (t == 3) c = vec3(0.20, 0.85, 0.25);
    else if (t == 4) c = vec3(0.90, 0.80, 0.40);
    else if (t == 5) c = vec3(0.45, 0.20, 0.60);
    outColor = vec4(c * (0.75 + 0.25 * max(vNormal.y, 0.0)), 1.0);
    return;
  }
  vec2 uv = vUV;
  vec3 N = normalize(vNormal);
  int blockType = int(vType + 0.5);
  float progress = uProgress;
  float season = uSeason;

  // 编辑风：地面取纸色系（#F9F8F6 的纸白 → 米灰）
  vec3 dirtLight = vec3(0.94, 0.92, 0.88);
  vec3 dirtMid   = vec3(0.90, 0.87, 0.82);
  vec3 dirtDark  = vec3(0.85, 0.81, 0.75);

  if (season > 0.5 && season < 1.5) {
    dirtLight = vec3(0.93, 0.91, 0.85);
    dirtMid   = vec3(0.88, 0.85, 0.78);
    dirtDark  = vec3(0.82, 0.78, 0.70);
  }

  vec3 sakuraLight = vec3(0.86, 0.60, 0.56);
  vec3 sakuraMid   = vec3(0.76, 0.42, 0.39);
  vec3 sakuraDeep  = vec3(0.63, 0.28, 0.26);
  vec3 sakuraRich  = vec3(0.48, 0.18, 0.16);

  if (uCustomStrength > 0.01) {
    sakuraLight = mix(sakuraLight, uCustom * 1.15, uCustomStrength);
    sakuraMid   = mix(sakuraMid,   uCustom * 0.90, uCustomStrength);
    sakuraDeep  = mix(sakuraDeep,  uCustom * 0.70, uCustomStrength);
    sakuraRich  = mix(sakuraRich,  uCustom * 0.55, uCustomStrength);
  }

  vec3 grassDark = vec3(0.30, 0.36, 0.20);
  vec3 grassMid = vec3(0.40, 0.47, 0.27);
  vec3 grassBright = vec3(0.52, 0.58, 0.36);

  if (season > 0.5 && season < 1.5) {
    // 夏：墨绿
    sakuraLight = vec3(0.42, 0.50, 0.30);
    sakuraMid   = vec3(0.28, 0.36, 0.19);
    sakuraDeep  = vec3(0.18, 0.24, 0.12);
    sakuraRich  = vec3(0.12, 0.16, 0.08);
    grassDark   = vec3(0.22, 0.28, 0.14);
    grassMid    = vec3(0.32, 0.40, 0.22);
    grassBright = vec3(0.44, 0.52, 0.30);
  } else if (season > 1.5 && season < 2.5) {
    // 秋：赭石
    sakuraLight = vec3(0.80, 0.52, 0.24);
    sakuraMid   = vec3(0.68, 0.38, 0.14);
    sakuraDeep  = vec3(0.54, 0.27, 0.09);
    sakuraRich  = vec3(0.40, 0.18, 0.06);
    grassDark   = vec3(0.50, 0.38, 0.18);
    grassMid    = vec3(0.62, 0.48, 0.24);
    grassBright = vec3(0.74, 0.60, 0.32);
  }

  vec3 barkLight = vec3(0.44, 0.42, 0.40);
  vec3 barkMid   = vec3(0.34, 0.33, 0.31);
  vec3 barkDark  = vec3(0.24, 0.23, 0.22);
  vec3 barkDeep  = vec3(0.16, 0.155, 0.15);

  float NdSun = max(dot(N, SUN_DIR), 0.0);
  float NdUp = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);

  float layer = vLayer;
  vec2 seed = vCell;
  float blockSeed = seed.x * 17.3 + seed.y * 31.1 + layer * 73.7;
  float noise1 = fract(sin(blockSeed) * 43758.5);
  float noise2 = fract(sin(blockSeed * 1.7 + 127.1) * 43758.5);
  float noise3 = fract(sin(blockSeed * 2.3 + 311.7) * 43758.5);

  float cx = uGrid * 0.5;
  float cy = uGrid * 0.5;
  float sdx = vCell.x - (cx + 1.5);
  float sdy = vCell.y - (cy + 1.5);
  float distShadow = sqrt(sdx * sdx + sdy * sdy);
  float canopyRadius = uGrid * 0.46;
  float trunkRadius = 2.5;
  float shadowT = 1.0 - smoothstep(trunkRadius, canopyRadius, distShadow);
  float trunkAO = (1.0 - smoothstep(0.0, trunkRadius * 1.5, distShadow)) * 0.20;
  // 平铺（二维码）模式下关闭地面投影，保证扫描对比度
  float treeShadow = mix(1.0, 1.0 - shadowT * 0.35 - trunkAO, 1.0 - progress);

  float maxCanopyLayer = 15.0;
  float layerRatio = min(layer / maxCanopyLayer, 1.0);
  float canopyAO = 0.65 + layerRatio * 0.35;

  vec3 albedo = vec3(0.5);

  if (vNormal.y > 0.5) {
    // ── 顶面：二维码对比度主要靠这里 ──
    vec3 topWarmTint = vec3(1.1, 1.08, 1.02);
    float isDarkModule = step(0.5, vType);

    if (blockType == 0) {
      vec3 dirtColor = dirtMid;
      float t = noise1;
      if (t < 0.4) dirtColor = mix(dirtLight, dirtMid, t / 0.4);
      else if (t < 0.7) dirtColor = mix(dirtMid, dirtDark, (t - 0.4) / 0.3);
      else dirtColor = mix(dirtDark, dirtDark * 0.85, (t - 0.7) / 0.3);
      float shift = (noise2 - 0.5) * 0.18;
      float grain = (noise3 - 0.5) * 0.08;
      dirtColor = dirtColor * (1.0 + shift + grain) * treeShadow;

      float distCenter = sqrt((vCell.x - cx) * (vCell.x - cx) + (vCell.y - cy) * (vCell.y - cy));
      float underCanopy = step(distCenter, canopyRadius);
      float speckle = noise3 * underCanopy;

      if (season < 0.5) {
        vec3 petalTint = vec3(0.90, 0.72, 0.70);
        dirtColor = mix(dirtColor, petalTint, step(0.85, speckle) * 0.4);
      } else if (season < 1.5) {
        vec3 greenSpeck = vec3(0.55, 0.68, 0.42);
        dirtColor = mix(dirtColor, greenSpeck, step(0.92, speckle) * 0.2);
      } else if (season < 2.5) {
        vec3 leafSpeck = mix(vec3(0.85, 0.52, 0.15), vec3(0.72, 0.35, 0.10), noise1);
        dirtColor = mix(dirtColor, leafSpeck, step(0.70, speckle) * 0.5);
      }
      albedo = dirtColor * topWarmTint;

    } else if (blockType == 1) {
      vec3 cherryColor = sakuraMid;
      float t = noise1;
      if (t < 0.33) cherryColor = mix(sakuraLight, sakuraMid, t / 0.33);
      else if (t < 0.66) cherryColor = mix(sakuraMid, sakuraDeep, (t - 0.33) / 0.33);
      else cherryColor = mix(sakuraDeep, sakuraRich, (t - 0.66) / 0.34);
      float shift = (noise2 - 0.5) * 0.15;
      cherryColor = cherryColor * (1.0 + shift);

      float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float roundedEdge = smoothstep(0.0, 0.12, edgeDist);
      float edgeDarken = mix(0.88, 1.0, roundedEdge);
      float finalEdge = mix(edgeDarken, 1.0, progress);
      albedo = cherryColor * topWarmTint * canopyAO * finalEdge;

    } else if (blockType == 2) {
      float trunkMaxLayer = 18.0;
      float heightRatio = min(layer / trunkMaxLayer, 1.0);
      vec3 sandColor = vec3(0.85, 0.78, 0.64);
      float sandShift = (noise1 - 0.5) * 0.1;
      vec3 groundSand = sandColor * (1.0 + sandShift) * treeShadow;

      vec3 barkColor = mix(barkMid, barkLight, noise1 * 0.4);
      float shift = (noise2 - 0.5) * 0.15;
      barkColor = barkColor * (1.0 + shift);
      float aoShadow = 0.6 + heightRatio * 0.4;
      float sandBlend = smoothstep(0.0, 0.15, heightRatio);
      albedo = mix(groundSand, barkColor * aoShadow, sandBlend) * topWarmTint;

    } else if (blockType == 3) {
      vec3 grassBrown = vec3(0.28, 0.25, 0.12);
      vec3 grassOlive = vec3(0.32, 0.35, 0.15);
      vec3 grassColor = grassMid;
      float t = noise1;
      if (t < 0.3) grassColor = mix(grassBright, grassMid, t / 0.3);
      else if (t < 0.6) grassColor = mix(grassMid, grassDark, (t - 0.3) / 0.3);
      else if (t < 0.8) grassColor = mix(grassDark, grassBrown, (t - 0.6) / 0.2);
      else grassColor = mix(grassBrown, grassOlive, (t - 0.8) / 0.2);
      float shift = (noise2 - 0.5) * 0.2;
      grassColor = grassColor * (1.0 + shift);
      albedo = grassColor * topWarmTint;

    } else if (blockType == 5) {
      vec3 branchColor = mix(barkMid, barkLight, noise1 * 0.5);
      float bShift = (noise2 - 0.5) * 0.12;
      branchColor = branchColor * (1.0 + bShift);
      float ringNoise = sin(noise1 * 12.0 + noise2 * 6.0) * 0.06 + 0.94;
      albedo = branchColor * ringNoise * topWarmTint * canopyAO;

    } else {
      vec3 sandA = vec3(0.84, 0.77, 0.63);
      vec3 sandB = vec3(0.80, 0.73, 0.60);
      vec3 sandPink = vec3(0.84, 0.74, 0.66);
      vec3 fallenColor = sandA;
      if (noise1 < 0.4) fallenColor = mix(sandA, sandB, noise2);
      else if (noise1 < 0.75) fallenColor = mix(sandB, sandPink, noise2 * 0.5);
      else fallenColor = mix(sandA, sandPink, noise2 * 0.4);
      float shift = (noise2 - 0.5) * 0.12;
      fallenColor = fallenColor * (1.0 + shift) * treeShadow;
      albedo = fallenColor * topWarmTint;
    }

    // ── 二维码模式对比度补偿 ──
    float qrBoost = progress * progress;
    float seasonDark = (season < 0.5 || season > 1.5) ? 0.08 : 0.0;
    float albedoBright = dot(albedo, vec3(0.299, 0.587, 0.114));
    float snowExtraDark = mix(0.0, 0.12, smoothstep(0.55, 0.8, albedoBright) * uCustomStrength);
    // 3D 视角下让地面二维码图案更含蓄（0.82），俯视时才拉满对比（0.43）
    float darkFactor = mix(0.82, 0.43 - snowExtraDark - seasonDark, qrBoost);
    float lightFactor = mix(0.20, 0.36, qrBoost);
    vec3 lightTarget = vec3(0.90, 0.87, 0.80);
    vec3 darkened = albedo * darkFactor;
    vec3 brightened = mix(albedo, lightTarget, lightFactor);
    albedo = mix(brightened, darkened, isDarkModule);

    // 扫描鲁棒性：平铺模式把深/浅模块拉向高对比目标（保留轻微纹理）
    vec3 qrDarkTarget = vec3(0.09, 0.08, 0.075);
    vec3 qrLightTarget = vec3(0.955, 0.945, 0.925);
    float qrTex = 0.95 + noise1 * 0.10;
    vec3 qrFlat = mix(qrLightTarget, qrDarkTarget, isDarkModule) * qrTex;
    albedo = mix(albedo, qrFlat, qrBoost * 0.92);

    // 3D 模式下让地面向四周淡出（"漂浮小岛"感），避免出现生硬的方形石板
    float radN = sqrt(pow(vCell.x - cx, 2.0) + pow(vCell.y - cy, 2.0)) / (uGrid * 0.5);
    float edgeFade = smoothstep(0.70, 1.04, radN) * (1.0 - progress) * 0.74;
    albedo = mix(albedo, vec3(0.9765, 0.9725, 0.9647), edgeFade);

  } else if (abs(vNormal.z) > 0.5 || abs(vNormal.x) > 0.5) {
    // ── 侧面 ──
    vec3 faceN = normalize(N);
    float sunLight = max(dot(faceN, SUN_DIR), 0.0);
    float shade = 0.3 + sunLight * 0.65;
    vec3 tint = vec3(0.95, 0.95, 0.98);

    if (layer < 1.0 && (blockType == 0 || blockType == 3 || blockType == 4)) {
      vec3 stoneLight = vec3(0.78, 0.72, 0.64);
      vec3 stoneMid = vec3(0.68, 0.62, 0.54);
      vec3 stoneDark = vec3(0.58, 0.52, 0.45);
      vec3 stoneColor = stoneMid;
      if (noise1 < 0.35) stoneColor = mix(stoneLight, stoneMid, noise2);
      else if (noise1 < 0.7) stoneColor = mix(stoneMid, stoneDark, noise2 * 0.6);
      else stoneColor = mix(stoneDark, stoneLight, noise2 * 0.3);
      float stoneShift = (noise3 - 0.5) * 0.08;
      stoneColor = stoneColor * (1.0 + stoneShift);
      albedo = stoneColor * shade * tint;

    } else if (blockType == 0) {
      vec3 dirtColor = dirtMid;
      float t = noise1;
      if (t < 0.4) dirtColor = mix(dirtLight, dirtMid, t / 0.4);
      else if (t < 0.7) dirtColor = mix(dirtMid, dirtDark, (t - 0.4) / 0.3);
      else dirtColor = dirtDark * (1.0 - (t - 0.7) * 0.2);
      float shift = (noise2 - 0.5) * 0.2;
      dirtColor = dirtColor * (1.0 + shift);
      albedo = dirtColor * shade * tint;

    } else if (blockType == 1) {
      vec3 cherryColor = sakuraMid;
      float t = noise1;
      if (t < 0.33) cherryColor = mix(sakuraLight, sakuraMid, t / 0.33);
      else if (t < 0.66) cherryColor = mix(sakuraMid, sakuraDeep, (t - 0.33) / 0.33);
      else cherryColor = mix(sakuraDeep, sakuraRich, (t - 0.66) / 0.34);
      float shift = (noise2 - 0.5) * 0.25;
      cherryColor = cherryColor * (1.0 + shift);
      float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float roundedEdge = smoothstep(0.0, 0.12, edgeDist);
      float edgeDarken = mix(0.7, 1.0, roundedEdge);
      albedo = cherryColor * shade * tint * canopyAO * edgeDarken;

    } else if (blockType == 2) {
      float radX = vCell.x - uGrid * 0.5;
      float radZ = vCell.y - uGrid * 0.5;
      float radLen = max(sqrt(radX * radX + radZ * radZ), 0.01);
      float cylNx = radX / radLen;
      float cylNz = radZ / radLen;
      vec3 cylN = normalize(vec3(cylNx * 0.8 + faceN.x * 0.2, faceN.y * 0.15, cylNz * 0.8 + faceN.z * 0.2));
      float cylSun = max(dot(cylN, SUN_DIR), 0.0);

      float heightRatio = min(layer / 18.0, 1.0);
      float ts = uTrunkSeed;
      float barkAngle = atan(radZ, radX);
      float groove1 = sin(barkAngle * (9.0 + ts * 7.0) + noise1 * 2.0) * 0.5 + 0.5;
      float groove2 = sin(barkAngle * (5.0 + ts * 5.0) + noise2 * 3.5 + 1.7) * 0.5 + 0.5;
      float groove3 = sin(barkAngle * (16.0 + ts * 8.0) + noise1 * 5.0) * 0.5 + 0.5;
      float grooveDepth = (groove1 * 0.5 + groove2 * 0.3 + groove3 * 0.2) * 0.25 + 0.75;

      float spiralAngle = barkAngle + heightRatio * (1.8 + ts * 2.0) + noise1 * 0.5;
      float woodGrain = sin(spiralAngle * (6.0 + ts * 5.0) + layer * 2.0) * 0.08 + 0.92;
      float ringPattern = sin(layer * (2.0 + ts * 3.5) + noise2 * 4.0) * 0.10 + 0.90;
      float knotNoise = sin(barkAngle * 3.0 + layer * 5.0 + noise3 * 6.0);
      float knot = smoothstep(0.85, 0.95, knotNoise) * 0.15;

      vec3 barkColor = mix(barkDark, barkMid, heightRatio * 0.7);
      barkColor = mix(barkColor, barkLight, groove1 * 0.3);
      barkColor = barkColor + vec3(0.08, 0.02, 0.10) * heightRatio * 0.3;
      float shift = (noise2 - 0.5) * 0.18;
      barkColor = barkColor * (1.0 + shift);
      barkColor = barkColor - knot;
      float hueShift = (ts - 0.5) * 0.10;
      barkColor = clamp(barkColor + vec3(hueShift, -abs(hueShift) * 0.25, -hueShift * 0.45), 0.0, 1.0);

      float edgeFade = 1.0 - smoothstep(0.6, 1.0, abs(dot(cylN, normalize(vec3(faceN.x, 0.0, faceN.z)))));
      float cylAO = 0.7 + edgeFade * 0.3;
      float vertAO = 0.60 + heightRatio * 0.40;
      float trunkShade = 0.22 + cylSun * 0.75;
      vec3 trunkAlbedo = barkColor * trunkShade * grooveDepth * woodGrain * ringPattern * cylAO * vertAO * tint;

      vec3 sandSideColor = vec3(0.78, 0.72, 0.58) * shade * tint;
      float sideBlend = smoothstep(0.0, 0.15, heightRatio);
      albedo = mix(sandSideColor, trunkAlbedo, sideBlend);

    } else if (blockType == 3) {
      vec3 grassBrown = vec3(0.28, 0.25, 0.12);
      vec3 grassOlive = vec3(0.32, 0.35, 0.15);
      vec3 grassColor = grassMid;
      float t = noise1;
      if (t < 0.3) grassColor = mix(grassBright, grassMid, t / 0.3);
      else if (t < 0.6) grassColor = mix(grassMid, grassDark, (t - 0.3) / 0.3);
      else if (t < 0.8) grassColor = mix(grassDark, grassBrown, (t - 0.6) / 0.2);
      else grassColor = mix(grassBrown, grassOlive, (t - 0.8) / 0.2);
      float shift = (noise2 - 0.5) * 0.2;
      grassColor = grassColor * (1.0 + shift);
      albedo = grassColor * shade * tint;

    } else if (blockType == 5) {
      vec3 branchColor = mix(barkDark, barkMid, noise1 * 0.6);
      float grooveSide = sin(layer * 5.0 + noise1 * 3.0) * 0.08 + 0.92;
      float bShift = (noise2 - 0.5) * 0.15;
      branchColor = branchColor * (1.0 + bShift) * grooveSide;
      albedo = branchColor * shade * tint;

    } else {
      vec3 sandSide = vec3(0.72, 0.66, 0.52);
      vec3 sandSideDark = vec3(0.62, 0.56, 0.44);
      vec3 fallenColor = mix(sandSide, sandSideDark, noise1 * 0.5);
      float shift = (noise2 - 0.5) * 0.12;
      fallenColor = fallenColor * (1.0 + shift);
      albedo = fallenColor * shade * tint;
    }

  } else {
    // ── 底面 ──
    vec3 bottomTint = vec3(0.65, 0.62, 0.58);
    vec3 fallenBottom = vec3(0.50, 0.45, 0.38);
    if (blockType == 0) albedo = dirtDark * 0.5 * bottomTint;
    else if (blockType == 1) albedo = sakuraDeep * 0.5 * bottomTint;
    else if (blockType == 2) albedo = barkDark * 0.5 * bottomTint;
    else if (blockType == 3) albedo = grassDark * 0.5 * bottomTint;
    else if (blockType == 5) albedo = barkDark * 0.5 * bottomTint;
    else albedo = fallenBottom * 0.6 * bottomTint;
  }

  vec3 viewDir = vec3(0.398015, 0.597022, 0.696526);
  float rimDot = 1.0 - max(dot(N, viewDir), 0.0);
  vec3 rimLight = pow(rimDot, 4.0) * 0.06 * vec3(0.85, 0.75, 0.95);

  vec3 diffuse = albedo * (AMBIENT + SUN_COL * NdSun * 0.85 + SKY_FILL * NdUp * 0.18 + BOUNCE * 0.15) + rimLight;
  vec3 hdr = finish(diffuse);

  // 秋雨：地面湿润 + 涟漪
  float rainVis = uRain * (1.0 - progress);
  if (rainVis > 0.01 && vNormal.y > 0.5 && blockType != 1) {
    vec3 specDir = normalize(vec3(0.4, 0.9, 0.3));
    vec3 viewD = normalize(vec3(0.4, 0.6, 0.7));
    vec3 halfV = normalize(specDir + viewD);
    float spec = pow(max(dot(N, halfV), 0.0), 32.0) * 0.16 * rainVis;
    hdr = hdr + vec3(spec);
    hdr = hdr * mix(1.0, 0.88, rainVis);

    if (blockType == 0 || blockType == 3 || blockType == 4) {
      vec2 c1 = vec2(vCell.x + sin(uTime * 1.3 + noise1 * 5.0) * 3.0,
                     vCell.y + cos(uTime * 1.1 + noise2 * 4.0) * 3.0);
      vec2 c2 = vec2(vCell.x + sin(uTime * 0.9 + noise2 * 7.0) * 4.0,
                     vCell.y + cos(uTime * 1.5 + noise1 * 3.0) * 4.0);
      float r1 = sin(length(vCell - c1) * 4.0 - uTime * 6.0) * 0.5 + 0.5;
      float r2 = sin(length(vCell - c2) * 3.5 - uTime * 5.0) * 0.5 + 0.5;
      float ri = (smoothstep(0.4, 0.6, r1) + smoothstep(0.4, 0.6, r2)) * 0.015 * rainVis;
      hdr = hdr + vec3(ri * 0.8, ri * 0.85, ri);
    }
  }

  outColor = vec4(hdr, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────
// 树枝：锥形圆柱段
// ─────────────────────────────────────────────────────────────────────────
export const BRANCH_VS = COMMON + `
layout(location = 0) in vec4 aA;   // ax, ay, az, ar
layout(location = 1) in vec4 aB;   // bx, by, bz, br
layout(location = 2) in vec4 aMeta; // depth, seed, 0, 0

out vec3 vNormal;
out float vSeed;
out float vDepth;

const int RADIAL = 10;

void main() {
  int vi = gl_VertexID;
  int quad = vi / 6;
  int lv = vi % 6;

  vec3 a = aA.xyz;
  vec3 b = aB.xyz;
  float ra = aA.w;
  float rb = aB.w;

  vec3 axis = b - a;
  float axisLen = length(axis);
  if (axisLen < 1e-6) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  axis /= axisLen;

  vec3 up = abs(axis.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 u = normalize(cross(axis, up));
  vec3 v = cross(axis, u);

  // 三角形: (top,0) (bot,0) (bot,1) | (top,0) (bot,1) (top,1)
  float ringT;
  int ai;
  if (lv == 0)      { ringT = 0.0; ai = 0; }
  else if (lv == 1) { ringT = 1.0; ai = 0; }
  else if (lv == 2) { ringT = 1.0; ai = 1; }
  else if (lv == 3) { ringT = 0.0; ai = 0; }
  else if (lv == 4) { ringT = 1.0; ai = 1; }
  else              { ringT = 0.0; ai = 1; }

  float ang = (float(quad + ai) / float(RADIAL)) * 6.2831853;
  vec3 radial = cos(ang) * u + sin(ang) * v;

  float vis = smoothstep(0.0, 0.4, 1.0 - uProgress);
  vec3 center = mix(a, b, ringT);
  float radius = mix(ra, rb, ringT);
  vec3 pos = center + radial * radius;

  // 塌缩到树干轴线
  vec3 baseA = a;
  pos = baseA + (pos - baseA) * vis;

  vNormal = radial;
  vSeed = aMeta.y;
  vDepth = aMeta.x;

  gl_Position = projectIso(pos);
}
`;

export const BRANCH_FS = COMMON + `
in vec3 vNormal;
in float vSeed;
in float vDepth;

out vec4 outColor;

void main() {
  vec3 N = normalize(vNormal);
  float NdSun = max(dot(N, SUN_DIR), 0.0);
  float NdUp = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);

  float s = vSeed;
  // 中性墨灰：与纸底/墨色正文同一族，不用暖棕
  vec3 barkLight = vec3(0.34, 0.325, 0.31);
  vec3 barkDark  = vec3(0.145, 0.135, 0.125);
  float depthT = clamp(vDepth / 5.0, 0.0, 1.0);
  vec3 barkBase = mix(barkDark, vec3(0.225, 0.215, 0.205), depthT);
  vec3 bark = mix(barkBase, barkLight, s * 0.25 + depthT * 0.15);
  bark *= 0.94 + 0.10 * fract(sin(s * 91.7) * 43758.5);

  vec3 albedo = bark;
  // 更平的明暗（像墨线而不是塑料圆柱）
  vec3 diffuse = albedo * (vec3(0.80) + SUN_COL * NdSun * 0.22 + SKY_FILL * NdUp * 0.05);
  outColor = vec4(finish(diffuse), 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// 植被：花朵（5 瓣立体花瓣 + 花心）；落叶复用同一套网格，只多一段下落动画
// ─────────────────────────────────────────────────────────────────────────
export const PETAL_VS = COMMON + `
uniform highp int uMesh;

layout(location = 0) in vec4 aFlower; // col, row, y, seed
layout(location = 1) in float aKind;  // 0 = 树冠花, 1 = 落叶（同网格）

out vec2 vUV;
out vec3 vNormal;
out float vT;
out float vSeed;
out float vKind;
out float vFade;
out float vAO;
out float vCenter;

const float TAU = 6.2831853;

vec2 cornerOf(int vi) {
  if (vi == 0) return vec2(-1.0, -1.0);
  if (vi == 1) return vec2( 1.0, -1.0);
  if (vi == 2) return vec2( 1.0,  1.0);
  if (vi == 3) return vec2(-1.0, -1.0);
  if (vi == 4) return vec2( 1.0,  1.0);
  return vec2(-1.0, 1.0);
}

void main() {
  float vis = smoothstep(0.0, 0.6, 1.0 - uProgress);
  vUV = vec2(0.0);
  vNormal = vec3(0.0, 1.0, 0.0);
  vT = 0.0;
  vSeed = aFlower.w;
  vKind = aKind;
  vFade = 0.0;
  vAO = 1.0;
  vCenter = 0.0;
  if (vis < 0.01) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  float halfGrid = uGrid * BLOCK * 0.5;
  vec3 base = vec3(aFlower.x * BLOCK - halfGrid, aFlower.z, aFlower.y * BLOCK - halfGrid);

  float rawSeed = aFlower.w;
  float isLeafShape = step(1.0, rawSeed);
  float seed = rawSeed - isLeafShape;
  float rnd = fract(seed * 91.7 + aFlower.x * 3.1 + aFlower.y * 7.3);

  // ── 位置动画 ──
  float fade = 1.0;
  float wind = 0.0;
  if (aKind > 0.5 && aKind < 1.5) {
    // 落叶：从树冠飘到地面
    float fall = fract(uTime * (0.055 + seed * 0.045) + seed * 3.7);
    base.y = aFlower.z * (1.0 - fall) + 0.004;
    float sway = 0.35 + fall * 0.65;
    base.x += sin(uTime * 1.15 + seed * 17.0) * 0.028 * sway;
    base.z += cos(uTime * 0.95 + seed * 11.0) * 0.024 * sway;
    fade = smoothstep(0.0, 0.08, fall) * smoothstep(1.0, 0.90, fall);
  } else {
    // 树冠花：微风摇曳
    float ground = step(base.y, BLOCK * 2.5);
    float wf = (1.0 - ground) * vis;
    base.x += (sin(uTime * 0.45 + aFlower.x * 0.25 + aFlower.y * 0.15) * 0.020
             + sin(uTime * 1.1 + aFlower.x * 0.8 + aFlower.y * 0.6) * 0.006) * wf;
    base.z += sin(uTime * 0.35 + aFlower.x * 0.15 + aFlower.y * 0.25) * 0.013 * wf;
    base.y += sin(uTime * 1.1 + seed * 11.0) * 0.0010 * wf;
  }
  vFade = fade;

  float aspect = uRes.x / uRes.y;
  float portrait = aspect < 0.8 ? 1.2 : 1.0;
  float wideBoost = mix(1.0, 1.20, smoothstep(1.30, 2.10, aspect));
  float viewScale = (mix(57.0, 46.4, uProgress) / uGrid) * portrait * mix(wideBoost, 1.0, uProgress) * mix(uZoom, 1.0, uProgress);
  float pxPerWorld = viewScale * uRes.y * 0.5;   // 用于把像素级细节换算成世界单位

  vec3 worldPos;
  vec3 normal;
  float shadeT = 1.0;

  if (uMesh == 0) {
    // ═══════ 花朵：5 片立体花瓣 + 花心 ═══════
    int vi = gl_VertexID;
    float sizeMul = 1.0;
    float flowerSize = BLOCK * (0.46 + seed * 0.40) * vis * sizeMul;
    float baseRot = seed * TAU;
    float tilt = 0.18 + fract(rnd * 3.7) * 0.22;       // 整朵花轻微前倾
    vec3 tiltAxis = normalize(vec3(cos(baseRot * 2.1), 0.0, sin(baseRot * 2.1)));

    if (vi < 120) {
      int petalIdx = vi / 24;
      int sv = vi % 24;
      int segIdx = sv / 6;
      int tv = sv % 6;

      int rowIdx; float side;
      if      (tv == 0) { rowIdx = segIdx;     side = -1.0; }
      else if (tv == 1) { rowIdx = segIdx;     side =  1.0; }
      else if (tv == 2) { rowIdx = segIdx + 1; side = -1.0; }
      else if (tv == 3) { rowIdx = segIdx + 1; side = -1.0; }
      else if (tv == 4) { rowIdx = segIdx;     side =  1.0; }
      else              { rowIdx = segIdx + 1; side =  1.0; }

      float t = float(rowIdx) * 0.25;
      float ang = float(petalIdx) * 1.2566371 + baseRot;
      float cosA = cos(ang), sinA = sin(ang);

      float len = flowerSize * 0.95;
      float dist = t * len;
      float hw = flowerSize * 0.30 * sin(t * 3.14159) * (1.0 - t * 0.25);
      float curl = flowerSize * 0.24 * 4.0 * t * (1.0 - t);

      vec3 along = vec3(cosA, 0.0, sinA);
      vec3 perp = vec3(-sinA, 0.0, cosA);
      worldPos = base + along * dist + perp * (hw * side) + vec3(0.0, curl, 0.0);

      // 花瓣法线：向上 + 沿花瓣方向微微外翻
      normal = normalize(vec3(0.0, 1.0, 0.0) * 0.9 + along * (0.25 + t * 0.5) + perp * (side * 0.12));
      vT = t;
      vCenter = 0.0;
    } else {
      // 花心：小圆盘
      int ci = vi - 120;
      int tri = ci / 3;
      int cv = ci % 3;
      float a0 = float(tri) / 10.0 * TAU;
      float a1 = a0 + TAU / 10.0;
      float r = flowerSize * 0.16;
      vec3 c0 = vec3(cos(a0), 0.0, sin(a0)) * r;
      vec3 c1 = vec3(cos(a1), 0.0, sin(a1)) * r;
      worldPos = base + (cv == 0 ? vec3(0.0) : (cv == 1 ? c0 : c1)) + vec3(0.0, flowerSize * 0.10, 0.0);
      normal = vec3(0.0, 1.0, 0.0);
      vT = 0.0;
      vCenter = 1.0;
    }

    // 整朵花轻微前倾（绕 tiltAxis）
    vec3 rel = worldPos - base;
    float ct = cos(tilt), st = sin(tilt);
    vec3 crossT = cross(tiltAxis, rel);
    worldPos = base + rel * ct + crossT * st + tiltAxis * dot(tiltAxis, rel) * (1.0 - ct);
    vUV = vec2(0.0);
  }

  // ── 光照 AO ──
  float depth01 = smoothstep(-0.30, 0.30, projectIso(worldPos).z / 0.02);
  vec3 canopyCenter = vec3(0.0, 0.42, 0.0);
  vec3 outN = normalize(worldPos - canopyCenter + vec3(0.0001));
  float ndl = max(dot(normalize(normal * 0.75 + outN * 0.35), vec3(-0.405616, 0.861934, -0.304212)), 0.0);
  float sunShade = 0.42 + 0.70 * ndl;
  vAO = mix(1.0, 0.32, depth01) * (0.80 + rnd * 0.40) * sunShade;
  vNormal = normal;

  gl_Position = projectIso(worldPos);
}
`;

export const PETAL_FS = COMMON + `
uniform highp int uMesh;

in vec2 vUV;
in vec3 vNormal;
in float vT;
in float vSeed;
in float vKind;
in float vFade;
in float vAO;
in float vCenter;

out vec4 outColor;

void main() {
  vec3 N = normalize(vNormal);
  float ndl = max(dot(N, vec3(-0.405616, 0.861934, -0.304212)), 0.0);
  float ndh = max(dot(N, normalize(vec3(-0.405616, 0.861934, -0.304212) + vec3(0.4, 0.6, 0.7))), 0.0);

  vec3 col;

  // ── 花朵 ──
  vec3 shadeDeep   = vec3(0.46, 0.16, 0.15);
  vec3 shadeMedium = vec3(0.62, 0.28, 0.26);
  vec3 shadeLight  = vec3(0.74, 0.42, 0.39);
  vec3 shadePale   = vec3(0.84, 0.58, 0.54);
  vec3 shadeWhite  = vec3(0.92, 0.76, 0.73);
  vec3 stamenGold  = vec3(0.78, 0.62, 0.26);

  if (uSeason > 0.5 && uSeason < 1.5) {
    shadeDeep   = vec3(0.20, 0.27, 0.15);
    shadeMedium = vec3(0.30, 0.38, 0.21);
    shadeLight  = vec3(0.42, 0.50, 0.30);
    shadePale   = vec3(0.56, 0.63, 0.42);
    shadeWhite  = vec3(0.70, 0.75, 0.56);
  } else if (uSeason > 1.5 && uSeason < 2.5) {
    shadeDeep   = vec3(0.44, 0.22, 0.08);
    shadeMedium = vec3(0.60, 0.34, 0.13);
    shadeLight  = vec3(0.74, 0.48, 0.22);
    shadePale   = vec3(0.82, 0.60, 0.32);
    shadeWhite  = vec3(0.90, 0.74, 0.48);
    stamenGold  = vec3(0.62, 0.44, 0.16);
  }

  if (uCustomStrength > 0.01) {
    shadeDeep   = mix(shadeDeep,   uCustom * 0.75, uCustomStrength);
    shadeMedium = mix(shadeMedium, uCustom * 0.95, uCustomStrength);
    shadeLight  = mix(shadeLight,  uCustom * 1.10, uCustomStrength);
    shadePale   = mix(shadePale,   uCustom * 1.25, uCustomStrength);
    shadeWhite  = mix(shadeWhite,  uCustom * 1.35, uCustomStrength);
  }

  if (vCenter > 0.5) {
    col = stamenGold * (0.92 + 0.16 * fract(vSeed * 13.3));
  } else {
    float tier = fract(vSeed * 7.31);
    float t = clamp(vT, 0.0, 1.0);
    col = mix(shadeDeep, shadeMedium, smoothstep(0.0, 0.45, t));
    col = mix(col, shadeLight, smoothstep(0.40, 0.85, t));
    col = mix(col, shadePale, smoothstep(0.80, 1.0, t) * 0.7);
    col = mix(col, shadeDeep * 1.08, smoothstep(0.55, 0.0, tier) * 0.5);
    col = mix(col, shadeWhite, smoothstep(0.78, 1.0, tier) * 0.5);
  }

  // 花瓣受光：主光 + 天光 + 一点点背光透射（花瓣薄）
  float sky = 0.5 + 0.5 * max(N.y, 0.0);
  float trans = max(dot(-N, vec3(-0.405616, 0.861934, -0.304212)), 0.0) * 0.18;
  col *= 0.34 + 0.52 * ndl + 0.16 * sky + trans;
  col *= 0.86 + 0.22 * vAO;
  // 花瓣边缘略透
  col *= mix(vec3(0.90, 0.93, 1.00), vec3(1.06, 1.00, 0.94), clamp(vAO * 1.1, 0.0, 1.0));

  outColor = vec4(finishFlower(col), vFade);
}
`;


// 地面投影阴影
// ─────────────────────────────────────────────────────────────────────────
export const SHADOW_VS = COMMON + `
out vec2 vUV;
void main() {
  int vi = gl_VertexID;
  vec2 qv;
  if      (vi == 0) qv = vec2(-1.0, -1.0);
  else if (vi == 1) qv = vec2( 1.0, -1.0);
  else if (vi == 2) qv = vec2(-1.0,  1.0);
  else if (vi == 3) qv = vec2(-1.0,  1.0);
  else if (vi == 4) qv = vec2( 1.0, -1.0);
  else              qv = vec2( 1.0,  1.0);

  vUV = qv * 0.5 + 0.5;

  float halfGrid = uGrid * BLOCK * 0.5;
  float shadowScale = 0.85;
  vec2 lightDirXZ = vec2(-0.5, -0.5);
  vec2 shadowOffset = -lightDirXZ * 0.48 * 0.35 * (1.0 - uProgress);

  vec3 local = vec3(qv.x * halfGrid * shadowScale + shadowOffset.x,
                    -0.004,
                    qv.y * halfGrid * shadowScale + shadowOffset.y);

  vec4 p = projectIso(local);
  p.z += 0.004;
  gl_Position = p;
}
`;

export const SHADOW_FS = COMMON + `
in vec2 vUV;
out vec4 outColor;
void main() {
  vec2 c = vUV - 0.5;
  c.x *= 0.85;
  float r = length(c) * 2.0;
  float a = smoothstep(1.0, 0.15, r) * 0.16 * (1.0 - uProgress);
  outColor = vec4(0.42, 0.34, 0.26, a);
}
`;
