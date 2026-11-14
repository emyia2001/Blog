import type { GraphLink } from "./graphData";

/**
 * 图谱彩蛋：墨色书虫（蠹鱼）。
 * 一条墨迹小虫在画布上蜿蜒漫游，饿了扑向一颗节点吞下（节点挣扎着缩进虫头、
 * 头部鼓起、食团沿身体滑向尾部），过一会儿原位弹回；光标靠近会掉头逃跑，
 * 光标静止久了胆子变大。身后留一条淡墨拖尾。纯视觉彩蛋，不碰力导管线——
 * 被吞节点用 fx/fy 钉在原地 + collide 半径归零（由 GraphView 侧查 swallowedIds）。
 * prefers-reduced-motion / bare 迷你图 / 节点过少时不初始化。
 */

export interface SnakeNode {
  id: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SnakeOptions {
  svg: SVGSVGElement;
  /** 虫层挂在 #graph-zoom 里（跟随缩放/平移，属于图谱世界的一部分） */
  zoomG: SVGGElement;
  nodes: SnakeNode[];
  /** 与 nodes 同序的节点 <g>，吞/吐动画直接改写其 transform */
  nodeEls: SVGGElement[];
  links: GraphLink[];
  linkEls: SVGLineElement[];
  /** 被吞节点 id 集合（GraphView 侧据此把 collide 半径与连线淡出） */
  swallowedIds: Set<string>;
  /** 无悬停时连线的常态透明度（吐出后恢复用） */
  restingLinkOpacity: string;
  /** 当前被拖拽/选中的节点 id（这类节点不吞） */
  busyId: () => string | null;
  cleanupSignal: AbortSignal;
}

/** 连线端点 id：d3 forceLink 会把端点改写成节点对象引用，两种形态都要认 */
const endId = (ref: unknown): string | null => {
  if (typeof ref === "string") return ref;
  const n = ref as { id?: string } | undefined;
  return n?.id ?? null;
};

const NS = "http://www.w3.org/2000/svg";

// ---- 形态 ----
const SEGMENTS = 14; // 头 + 身体节数
const SEG_GAP = 3.6; // 节间距（px），总长 ≈ 47px
const HEAD_R = 4.2;

// ---- 行为（16ms 一帧的尺度） ----
const SPEED_WANDER = 1.5;
const SPEED_SEEK = 2.3;
const SPEED_FLEE = 4.4;
const LUNGE_DIST = 26; // 扑咬距离：进入后加速突进
const LUNGE_SPEED = SPEED_SEEK * 2.1;
const TURN_WANDER = 0.085; // 每帧最大转角（rad）
const TURN_SEEK = 0.12;
const TURN_FLEE = 0.26; // 逃命时掉头要快
const FLEE_R = 100; // 光标进入此半径触发逃跑
const FLEE_EXIT_R = 155; // 逃出此半径才解除（滞回，避免边界抖动）
const POINTER_IDLE_MS = 2500; // 光标静止超过此时长，虫子胆子变大
const FLEE_IDLE_R = 40; // 光标静止时的逃跑半径（贴脸才跑，不再被永久流放）
const WALL_MARGIN = 46; // 软墙：靠近边缘提前转向
const TERMINAL_R = 70; // 终段归巢距离：逼近猎物时减速收紧转弯
const SEEK_GIVEUP_MS = 9000; // 追同一颗超时换目标（防病态绕圈/不可达）
const EAT_DIST = 11; // 嘴碰到节点边缘的距离即吞
const EAT_FIRST_MS = 6000; // 落地后第一次开饭
const EAT_COOLDOWN_MS = 9000;
const EAT_COOLDOWN_JITTER_MS = 5000;
const RESPAWN_MS = 15000; // 吞下后多久吐回来
const GULP_MS = 620; // 吞入动画时长（节点缩进虫头）
const LUMP_SPEED = 0.3; // 食团沿身体滑动的速度（节/帧@16ms）
const TRAIL_MS = 1100; // 拖尾墨点淡出时长
const TRAIL_EVERY_MS = 90; // 拖尾落墨间隔
const POP_MS = 420; // 吐出弹回动画时长
const MAX_CONCURRENT_EATEN = 1; // 同屏最多吞一颗，图谱不至于残缺太久

interface Seg {
  x: number;
  y: number;
}

export function initSnake(o: SnakeOptions): () => void {
  const { svg, zoomG, nodes, nodeEls, links, linkEls, swallowedIds } = o;

  // ---- 虫层 DOM：拖尾墨点垫底 → 身体（墨色分节斑纹，渐隐收尾）→ 砖红头 + 眼点 ----
  const layer = document.createElementNS(NS, "g");
  layer.setAttribute("id", "graph-snake");
  layer.setAttribute("aria-hidden", "true");
  // 虫是纯装饰：不拦指针，节点照常可点；抓取靠下面的隐形 hit 线显式开启
  layer.style.pointerEvents = "none";
  zoomG.appendChild(layer);

  const trailG = document.createElementNS(NS, "g");
  layer.appendChild(trailG);

  // 隐形抓取线：沿头→尾的粗透明描边，鼠标按住即拎起小蛇
  const hitLine = document.createElementNS(NS, "line");
  hitLine.setAttribute("stroke", "transparent");
  hitLine.setAttribute("stroke-width", "14");
  hitLine.setAttribute("stroke-linecap", "round");
  hitLine.style.pointerEvents = "stroke";
  hitLine.style.cursor = "grab";
  layer.appendChild(hitLine);

  const segEls: SVGCircleElement[] = [];
  const segBaseR: number[] = [];
  const segs: Seg[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const c = document.createElementNS(NS, "circle");
    const t = i / (SEGMENTS - 1);
    if (i === 0) {
      c.setAttribute("r", String(HEAD_R));
      c.setAttribute("fill", "var(--color-ed-accent)");
    } else {
      const r = 3.3 - t * 2.0;
      segBaseR.push(r);
      c.setAttribute("r", r.toFixed(2));
      // 分节斑纹：偶数节略深，读出一段段的躯干
      const band = i % 2 === 0 ? 0.06 : -0.06;
      c.setAttribute("fill", "var(--color-ed-fg)");
      c.setAttribute("fill-opacity", Math.max(0.14, 0.86 - t * 0.6 + band).toFixed(2));
    }
    layer.appendChild(c);
    segEls.push(c);
    segs.push({ x: 0, y: 0 });
  }
  // 头部小眼点（随朝向摆动才有「活物」感）
  const eyes: SVGCircleElement[] = [];
  for (let i = 0; i < 2; i++) {
    const e = document.createElementNS(NS, "circle");
    e.setAttribute("r", "0.7");
    e.setAttribute("fill", "var(--color-ed-bg)");
    layer.appendChild(e);
    eyes.push(e);
  }

  // ---- 状态 ----
  const W = () => svg.clientWidth || 800;
  const H = () => svg.clientHeight || 500;
  let heading = Math.PI * 0.75;
  let speed = SPEED_WANDER;
  for (const s of segs) {
    s.x = W() / 2;
    s.y = H() / 2;
  }
  let wanderTarget = pickWanderTarget();
  let wanderUntil = 0;
  let fleeing = false;
  let nextEatAt = performance.now() + EAT_FIRST_MS;
  let targetNodeId: string | null = null;
  let seekSince = 0; // 本次追踪开始时刻（超时换目标用）
  let lumpIdx = -1; // 食团位置（沿身体节数滑动，-1 = 无）
  let trailAt = 0;
  // 抓取：鼠标按住虫身拎起，甩动松手 = 丢出去
  let grab: { pointerId: number } | null = null;
  const grabTrail: { x: number; y: number; t: number }[] = [];
  let prevHead: Seg = { x: 0, y: 0 };
  interface TrailDot {
    el: SVGCircleElement;
    t0: number;
  }
  const trail: TrailDot[] = [];
  // 吞/吐动画：{ node, el, from, t0 }——from 是动画起始的 scale
  interface Anim {
    node: SnakeNode;
    el: SVGGElement;
    from: number;
    t0: number;
  }
  const gulps: Anim[] = [];
  const pops: Anim[] = [];
  const eatenAt = new Map<string, number>();
  const eatenHome = new Map<string, Seg>(); // 被吞节点的原位（吐出时归位）
  const eatenLinks = new Map<string, SVGLineElement[]>();

  const pointer = { x: -9999, y: -9999 };
  let pointerMovedAt = -Infinity; // 上次光标移动时刻（静止久了虫子不再怕）
  const onPointerMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointerMovedAt = performance.now();
  };
  window.addEventListener("pointermove", onPointerMove, {
    signal: o.cleanupSignal,
    passive: true,
  });

  // ---- 抓取与丢弃：按住虫身拎起（头贴指针、身体垂随），甩动松手 = 丢出去 ----
  layer.addEventListener("pointerdown", (e) => {
    // 事件只会从虫的 hit 线冒上来；拦下，别让画布把这次按下当成平移起点
    e.stopPropagation();
    grab = { pointerId: e.pointerId };
    grabTrail.length = 0;
    hitLine.style.cursor = "grabbing";
  });
  const onGrabUp = (e: PointerEvent) => {
    if (!grab || e.pointerId !== grab.pointerId) return;
    grab = null;
    hitLine.style.cursor = "grab";
    // 甩出：取最后 ~120ms 的指针轨迹算手速，方向即航向；steer 会把速度
    // 自然衰减回漫游值——被丢出去的虫滑行一段后自己恢复常态
    const now = performance.now();
    const recent = grabTrail.filter((p) => now - p.t < 120);
    if (recent.length >= 2) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = Math.max(16, b.t - a.t);
      const vx = ((b.x - a.x) / dt) * 16;
      const vy = ((b.y - a.y) / dt) * 16;
      const mag = Math.hypot(vx, vy);
      if (mag > 1.4) {
        heading = Math.atan2(vy, vx);
        speed = Math.min(9, mag);
        fleeing = false;
      }
    }
    grabTrail.length = 0;
  };
  window.addEventListener("pointerup", onGrabUp, { signal: o.cleanupSignal });
  window.addEventListener("pointercancel", onGrabUp, {
    signal: o.cleanupSignal,
  });

  function pickWanderTarget(): Seg {
    const m = WALL_MARGIN + 20;
    return {
      x: m + Math.random() * (W() - m * 2),
      y: m + Math.random() * (H() - m * 2),
    };
  }

  /** client 坐标 → 图谱 zoom 空间坐标 */
  function toGraphSpace(clientX: number, clientY: number): Seg | null {
    const ctm = zoomG.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function pickPrey(): SnakeNode | null {
    const busy = o.busyId();
    const pool = nodes.filter((n) => !swallowedIds.has(n.id) && n.id !== busy);
    if (pool.length <= 1) return null; // 留一颗保底，图不至于空
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function swallow(node: SnakeNode, el: SVGGElement) {
    targetNodeId = null;
    nextEatAt =
      performance.now() + EAT_COOLDOWN_MS + Math.random() * EAT_COOLDOWN_JITTER_MS;
    // 记录原位：吞入动画会把节点吸向虫头，吐出时要回到这里，
    // 否则节点在虫腹位置复活、连线被拉到结构之外
    eatenHome.set(node.id, { x: node.x, y: node.y });
    // 该节点的连线沉底（吐出时恢复常态透明度）
    const mine = linkEls.filter((line, i) => {
      const l = links[i];
      return endId(l.source) === node.id || endId(l.target) === node.id;
    });
    for (const line of mine) {
      line.setAttribute("opacity", "0.05");
      line.classList.add("is-eaten");
    }
    eatenLinks.set(node.id, mine);
    swallowedIds.add(node.id);
    eatenAt.set(node.id, performance.now());
    gulps.push({ node, el, from: 1, t0: performance.now() });
    speed = SPEED_WANDER;
  }

  function respawn(node: SnakeNode) {
    swallowedIds.delete(node.id);
    eatenAt.delete(node.id);
    // 归位到被吞前的原位（越界则压回当前画布内——展开/还原换过画布时兜底）
    const home = eatenHome.get(node.id);
    if (home) {
      node.x = Math.max(26, Math.min(W() - 26, home.x));
      node.y = Math.max(38, Math.min(H() - 42, home.y));
    }
    eatenHome.delete(node.id);
    node.fx = null;
    node.fy = null;
    const el = nodeEls[nodes.indexOf(node)];
    if (el) {
      el.style.display = "";
      pops.push({ node, el, from: 0, t0: performance.now() });
    }
    for (const line of eatenLinks.get(node.id) ?? []) {
      line.classList.remove("is-eaten");
      line.setAttribute("opacity", o.restingLinkOpacity);
    }
    eatenLinks.delete(node.id);
  }

  function applyNodeTransform(
    el: SVGGElement,
    x: number,
    y: number,
    scale: number
  ) {
    el.setAttribute(
      "transform",
      scale === 1
        ? `translate(${x},${y})`
        : `translate(${x},${y}) scale(${scale.toFixed(3)})`
    );
  }

  /** 朝目标方向以限转率转向；返回当前帧速度 */
  function steer(
    target: Seg,
    maxSpeed: number,
    turnRate: number,
    dtScale: number
  ): number {
    const dx = target.x - segs[0].x;
    const dy = target.y - segs[0].y;
    const want = Math.atan2(dy, dx);
    let diff = want - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(
      -turnRate * dtScale,
      Math.min(turnRate * dtScale, diff)
    );
    heading += turn;
    // 速度随转向量增减：直线加速，急转弯减速（更读得出「用力」）
    const align = Math.cos(diff);
    const targetSpeed = maxSpeed * (0.55 + 0.45 * Math.max(0, align));
    speed += (targetSpeed - speed) * Math.min(1, 0.15 * dtScale);
    return speed;
  }

  function step(dtMs: number) {
    const now = performance.now();
    const dtScale = Math.max(0.2, Math.min(2, dtMs / 16));
    const head = segs[0];

    // 光标状态：静止 2.5s 后逃跑半径收窄——不然光标一直停在图上，虫子被永久
    // 流放到边缘，看起来像被一道看不见的边框困住
    const cursorIdle = now - pointerMovedAt > POINTER_IDLE_MS;
    const fleeR = cursorIdle ? FLEE_IDLE_R : FLEE_R;
    const fleeExitR = cursorIdle ? FLEE_IDLE_R + 55 : FLEE_EXIT_R;
    const pointerGraph = toGraphSpace(pointer.x, pointer.y);
    let mode: "wander" | "seek" | "flee" = "wander";
    let target: Seg = wanderTarget;
    let seekDist = Infinity;

    // 该吐的先吐（任何状态下照吐，节点不多等）
    for (const [id, at] of eatenAt) {
      if (now - at >= RESPAWN_MS) {
        const node = nodes.find((n) => n.id === id);
        if (node) respawn(node);
      }
    }

    if (grab) {
      // 被拎起：头贴指针，身体垂链跟随；不觅食不逃跑，吞/吐动画照常播完
      if (pointerGraph) {
        grabTrail.push({ x: pointerGraph.x, y: pointerGraph.y, t: now });
        if (grabTrail.length > 10) grabTrail.shift();
        head.x = pointerGraph.x;
        head.y = pointerGraph.y;
      }
    } else {
      // 1) 行为决策：逃跑 > 觅食 > 漫游
      if (pointerGraph) {
        const d = Math.hypot(pointerGraph.x - head.x, pointerGraph.y - head.y);
        if (fleeing ? d < fleeExitR : d < fleeR) {
          fleeing = true;
          // 逃离方向 = 背离光标，并往画布内侧偏一点（别把自己顶出墙）
          const away = Math.atan2(head.y - pointerGraph.y, head.x - pointerGraph.x);
          target = {
            x: head.x + Math.cos(away) * 90,
            y: head.y + Math.sin(away) * 90,
          };
          mode = "flee";
        } else if (d > fleeExitR) {
          fleeing = false;
        }
      }
      if (mode !== "flee") {
        if (now >= nextEatAt && swallowedIds.size < MAX_CONCURRENT_EATEN) {
          if (!targetNodeId) {
            const prey = pickPrey();
            if (prey) {
              targetNodeId = prey.id;
              seekSince = now;
            } else nextEatAt = now + 4000;
          } else if (now - seekSince > SEEK_GIVEUP_MS) {
            // 追太久没吃到（绕圈/被光标反复吓跑）：换一颗再试
            targetNodeId = null;
          }
          if (targetNodeId) {
            const prey = nodes.find((n) => n.id === targetNodeId);
            if (prey) {
              target = { x: prey.x, y: prey.y };
              seekDist = Math.hypot(prey.x - head.x, prey.y - head.y);
              mode = "seek";
            } else {
              targetNodeId = null;
            }
          }
        }
        if (mode === "wander") {
          if (now > wanderUntil) {
            wanderTarget = pickWanderTarget();
            wanderUntil = now + 2200 + Math.random() * 1800;
          }
          target = wanderTarget;
          if (Math.hypot(target.x - head.x, target.y - head.y) < 14) {
            wanderTarget = pickWanderTarget();
          }
        }
      }

      // 2) 转向 + 前进，软墙反弹
      let maxSpeed =
        mode === "flee" ? SPEED_FLEE : mode === "seek" ? SPEED_SEEK : SPEED_WANDER;
      let turn =
        mode === "flee" ? TURN_FLEE : mode === "seek" ? TURN_SEEK : TURN_WANDER;
      if (mode === "seek") {
        // 终段归巢：中距收紧转弯，把转弯半径（≈ v/ω）压到捕获半径以下——
        // 否则掠过猎物侧沿会进入稳定绕圈，永远差几像素吃不到
        if (seekDist < LUNGE_DIST) {
          // 扑咬：贴脸后加速突进，读作「张口一击」
          maxSpeed = LUNGE_SPEED;
          turn *= 3.2;
        } else if (seekDist < TERMINAL_R) {
          const k = (seekDist - LUNGE_DIST) / (TERMINAL_R - LUNGE_DIST);
          maxSpeed *= 0.5 + 0.5 * k;
          turn *= 1 + (1 - k) * 1.6;
        }
      }
      steer(target, maxSpeed, turn, dtScale);
      const dist = speed * dtScale;
      head.x += Math.cos(heading) * dist;
      head.y += Math.sin(heading) * dist;
      const mx = WALL_MARGIN;
      if (head.x < mx || head.x > W() - mx) {
        heading = Math.PI - heading;
        head.x = Math.max(mx, Math.min(W() - mx, head.x));
      }
      if (head.y < mx || head.y > H() - mx) {
        heading = -heading;
        head.y = Math.max(mx, Math.min(H() - mx, head.y));
      }

      // 4) 觅食命中 → 吞
      if (mode === "seek" && targetNodeId && swallowedIds.size < MAX_CONCURRENT_EATEN) {
        const prey = nodes.find((n) => n.id === targetNodeId);
        const idx = prey ? nodes.indexOf(prey) : -1;
        if (prey && idx >= 0 && idx < nodeEls.length) {
          if (Math.hypot(prey.x - head.x, prey.y - head.y) < EAT_DIST) {
            swallow(prey, nodeEls[idx]);
          }
        } else {
          targetNodeId = null;
        }
      }
    }

    // 3) 身体节链跟随：每节保持固定间距（直链垂随，不叠加弯曲波）
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1];
      const cur = segs[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      cur.x = prev.x + (dx / d) * SEG_GAP;
      cur.y = prev.y + (dy / d) * SEG_GAP;
    }

    // 5) 吞入动画：节点带点挣扎地缩进虫头；头部随之鼓起
    for (let i = gulps.length - 1; i >= 0; i--) {
      const a = gulps[i];
      const p = Math.min(1, (now - a.t0) / GULP_MS);
      const e = p * p; // ease-in：越咬越快
      // 节点缩着被吸向虫头，途中小幅扑腾（挣扎感随进度衰减）
      a.node.x += (segs[0].x - a.node.x) * e * 0.24;
      a.node.y += (segs[0].y - a.node.y) * e * 0.24;
      const wob = Math.sin(p * 26) * (1 - p) * 1.7;
      applyNodeTransform(
        a.el,
        a.node.x + wob,
        a.node.y + Math.cos(p * 21) * (1 - p) * 1.3,
        Math.max(0, 1 - e)
      );
      if (p >= 1) {
        a.el.style.display = "none";
        // 钉在原地：连线端点不漂，collide 半径由 GraphView 按 swallowedIds 归零
        a.node.fx = a.node.x;
        a.node.fy = a.node.y;
        gulps.splice(i, 1);
        lumpIdx = 0.4; // 食团从颈部开始沿身体滑向尾部
      }
    }
    // 食团滑行（纯视觉）
    if (lumpIdx >= 0) {
      lumpIdx += dtScale * LUMP_SPEED;
      if (lumpIdx > SEGMENTS + 1) lumpIdx = -1;
    }
    // 吐出弹回：0 → 1.18 → 1 过冲
    for (let i = pops.length - 1; i >= 0; i--) {
      const a = pops[i];
      const p = Math.min(1, (now - a.t0) / POP_MS);
      const e =
        p < 0.7
          ? (p / 0.7) * 1.18
          : 1.18 - ((p - 0.7) / 0.3) * 0.18;
      applyNodeTransform(a.el, a.node.x, a.node.y, Math.max(0, e));
      if (p >= 1) {
        applyNodeTransform(a.el, a.node.x, a.node.y, 1);
        pops.splice(i, 1);
      }
    }

    // 6) 拖尾：头部实际位移明显时，尾部落一滴淡墨（拎起甩动也会留痕）
    const moved = Math.hypot(head.x - prevHead.x, head.y - prevHead.y);
    prevHead.x = head.x;
    prevHead.y = head.y;
    if (moved > 0.7 && now - trailAt > TRAIL_EVERY_MS) {
      trailAt = now;
      const tail = segs[segs.length - 1];
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", tail.x.toFixed(1));
      dot.setAttribute("cy", tail.y.toFixed(1));
      dot.setAttribute("r", "1.1");
      dot.setAttribute("fill", "var(--color-ed-fg)");
      dot.setAttribute("fill-opacity", "0.16");
      trailG.appendChild(dot);
      trail.push({ el: dot, t0: now });
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const t = trail[i];
      const p = (now - t.t0) / TRAIL_MS;
      if (p >= 1) {
        t.el.remove();
        trail.splice(i, 1);
      } else {
        t.el.setAttribute("fill-opacity", (0.16 * (1 - p)).toFixed(3));
      }
    }
  }

  function render() {
    // 抓取 hit 线跟随头尾（用户按住虫身任意位置即可拎起）
    hitLine.setAttribute("x1", segs[0].x.toFixed(1));
    hitLine.setAttribute("y1", segs[0].y.toFixed(1));
    hitLine.setAttribute("x2", segs[segs.length - 1].x.toFixed(1));
    hitLine.setAttribute("y2", segs[segs.length - 1].y.toFixed(1));
    for (let i = 0; i < segs.length; i++) {
      segEls[i].setAttribute("cx", segs[i].x.toFixed(1));
      segEls[i].setAttribute("cy", segs[i].y.toFixed(1));
      if (i === 0) {
        // 吞入时头部渐进鼓起（sin 过钟形：咬合最紧时最大）
        let headScale = 1;
        if (gulps.length > 0) {
          const p = Math.min(1, (performance.now() - gulps[0].t0) / GULP_MS);
          headScale = 1 + 0.55 * Math.sin(p * Math.PI);
        }
        segEls[0].setAttribute("r", (HEAD_R * headScale).toFixed(2));
      } else if (lumpIdx >= 0) {
        // 食团鼓包：高斯包沿身体滑过时该节临时变粗
        const bump = Math.exp(-Math.pow(lumpIdx - i, 2) / 1.4) * 0.95;
        segEls[i].setAttribute("r", (segBaseR[i - 1] * (1 + bump)).toFixed(2));
      } else if (i > 0) {
        segEls[i].setAttribute("r", segBaseR[i - 1].toFixed(2));
      }
    }
    // 眼点：垂直朝向两侧偏移，像在「看路」
    const hx = segs[0].x;
    const hy = segs[0].y;
    const px = -Math.sin(heading);
    const py = Math.cos(heading);
    eyes[0].setAttribute("cx", (hx + px * 1.4 - Math.cos(heading) * 1.2).toFixed(1));
    eyes[0].setAttribute("cy", (hy + py * 1.4 - Math.sin(heading) * 1.2).toFixed(1));
    eyes[1].setAttribute("cx", (hx - px * 1.4 - Math.cos(heading) * 1.2).toFixed(1));
    eyes[1].setAttribute("cy", (hy - py * 1.4 - Math.sin(heading) * 1.2).toFixed(1));
  }

  let raf = 0;
  let last = 0;
  function frame(now: number) {
    const dt = last ? Math.min(48, now - last) : 16;
    last = now;
    step(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    layer.remove();
    // 被吞节点在虫被卸载时全部吐回（页面销毁时无所谓，但 bfcache 回存要干净）
    for (const id of [...eatenAt.keys()]) {
      const node = nodes.find((n) => n.id === id);
      if (node) respawn(node);
    }
  };
}
