/**
 * renderer.js — WebGL2 渲染器
 * 几何体全部由 gl_VertexID 程序化生成（instancing），零运行时依赖。
 *   方块 36 顶点/实例 · 树枝 36 · 花朵 150 · 草丛 30 · 落叶 6
 */
import {
  BLOCK_VS, BLOCK_FS, BRANCH_VS, BRANCH_FS,
  PETAL_VS, PETAL_FS, SHADOW_VS, SHADOW_FS,
} from './shaders.js';

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error('Shader compile error:\n' + log);
    throw new Error(log);
  }
  return sh;
}

function program(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  return p;
}

const UNIFORM_NAMES = [
  'uProgress', 'uTime', 'uGrid', 'uRes', 'uBobX', 'uBobY',
  'uSeason', 'uCustom', 'uCustomStrength', 'uRain', 'uTrunkSeed', 'uDebug', 'uZoom', 'uShiftY', 'uMesh',
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    this.progBlock = program(gl, BLOCK_VS, BLOCK_FS);
    this.progBranch = program(gl, BRANCH_VS, BRANCH_FS);
    this.progVeg = program(gl, PETAL_VS, PETAL_FS);
    this.progShadow = program(gl, SHADOW_VS, SHADOW_FS);

    const locs = (prog) => {
      const o = {};
      for (const n of UNIFORM_NAMES) o[n] = gl.getUniformLocation(prog, n);
      return o;
    };
    this.uBlock = locs(this.progBlock);
    this.uBranch = locs(this.progBranch);
    this.uVeg = locs(this.progVeg);
    this.uShadow = locs(this.progShadow);

    this.vaoBlock = gl.createVertexArray();
    this.vaoBranch = gl.createVertexArray();
    this.vaoFlower = gl.createVertexArray();
    this.vaoShadow = gl.createVertexArray();

    this.bufBlock = gl.createBuffer();
    this.bufBranchA = gl.createBuffer();
    this.bufBranchB = gl.createBuffer();
    this.bufBranchM = gl.createBuffer();
    this.bufFlower = gl.createBuffer();
    this.bufFlowerKind = gl.createBuffer();

    this.counts = { blocks: 0, segments: 0, flowers: 0 };
    this.hide = { blocks: false, branches: false, flowers: false, shadow: false };

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.9765, 0.9725, 0.9647, 1.0);   // #F9F8F6 纸底

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  resize(cssW, cssH) {
    const gl = this.gl;
    const w = Math.max(1, Math.floor(cssW * this.dpr));
    const h = Math.max(1, Math.floor(cssH * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  setBlocks(blocks) {
    const gl = this.gl;
    gl.bindVertexArray(this.vaoBlock);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBlock);
    gl.bufferData(gl.ARRAY_BUFFER, blocks.data.subarray(0, blocks.count * 4), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.bindVertexArray(null);
    this.counts.blocks = blocks.count;
  }

  setBranches(branches) {
    const gl = this.gl;
    const n = branches.segmentCount;
    const a = new Float32Array(n * 4);
    const b = new Float32Array(n * 4);
    const m = new Float32Array(n * 4);
    const src = branches.segments;
    const RADIUS_BOOST = 1.12;  // 枝条略加粗，保证骨架可读
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      a[i * 4] = src[o]; a[i * 4 + 1] = src[o + 1]; a[i * 4 + 2] = src[o + 2]; a[i * 4 + 3] = src[o + 3] * RADIUS_BOOST;
      b[i * 4] = src[o + 4]; b[i * 4 + 1] = src[o + 5]; b[i * 4 + 2] = src[o + 6]; b[i * 4 + 3] = src[o + 7] * RADIUS_BOOST;
      m[i * 4] = src[o + 8]; m[i * 4 + 1] = src[o + 9];
    }
    gl.bindVertexArray(this.vaoBranch);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBranchA);
    gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBranchB);
    gl.bufferData(gl.ARRAY_BUFFER, b, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufBranchM);
    gl.bufferData(gl.ARRAY_BUFFER, m, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.counts.segments = n;
  }

  _setInstanced(vao, buf, kindBuf, data, count, kinds) {
    const gl = this.gl;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * 4), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, kindBuf);
    gl.bufferData(gl.ARRAY_BUFFER, kinds, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }

  setFlowers({ data, count, kinds }) {
    this._setInstanced(this.vaoFlower, this.bufFlower, this.bufFlowerKind, data, count,
      kinds || new Float32Array(count));
    this.counts.flowers = count;
  }

  _setUniforms(gl, locs, s) {
    gl.uniform1f(locs.uProgress, s.progress);
    gl.uniform1f(locs.uTime, s.time);
    gl.uniform1f(locs.uGrid, s.gridSize);
    gl.uniform2f(locs.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(locs.uZoom, s.zoom ?? 1);
    gl.uniform1f(locs.uShiftY, s.shiftY ?? 0);
    gl.uniform1f(locs.uBobX, s.bobX);
    gl.uniform1f(locs.uBobY, s.bobY);
    gl.uniform1f(locs.uSeason, s.season);
    gl.uniform3f(locs.uCustom, s.custom[0], s.custom[1], s.custom[2]);
    gl.uniform1f(locs.uCustomStrength, s.custom[3]);
    gl.uniform1f(locs.uRain, s.rain);
    gl.uniform1f(locs.uTrunkSeed, s.trunkSeed);
    gl.uniform1f(locs.uDebug, s.debug || 0);
  }

  render(state) {
    const gl = this.gl;
    const hide = this.hide;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1. 地面投影阴影
    if (!hide.shadow) {
      gl.useProgram(this.progShadow);
      this._setUniforms(gl, this.uShadow, state);
      gl.depthMask(false);
      gl.bindVertexArray(this.vaoShadow);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
    }

    // 2. 体素方块
    if (this.counts.blocks > 0 && !hide.blocks) {
      gl.useProgram(this.progBlock);
      this._setUniforms(gl, this.uBlock, state);
      gl.bindVertexArray(this.vaoBlock);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.counts.blocks);
    }

    // 3. 树枝
    if (this.counts.segments > 0 && !hide.branches) {
      gl.useProgram(this.progBranch);
      this._setUniforms(gl, this.uBranch, state);
      gl.bindVertexArray(this.vaoBranch);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 60, this.counts.segments);   // RADIAL(10) × 6
    }

    // 4. 植被：花朵 / 草丛 / 落叶
    gl.useProgram(this.progVeg);
    this._setUniforms(gl, this.uVeg, state);
    gl.depthMask(true);

    if (this.counts.flowers > 0 && !hide.flowers) {
      gl.uniform1i(this.uVeg.uMesh, 0);
      gl.bindVertexArray(this.vaoFlower);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 150, this.counts.flowers);
    }

    gl.bindVertexArray(null);
  }

  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }

  dispose() {
    const gl = this.gl;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
