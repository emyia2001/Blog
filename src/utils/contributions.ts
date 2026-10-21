import { GITHUB_REPO } from "../consts";

// GitHub 贡献热力图取数（构建时执行，烤进页面）。
// 有 GITHUB_CONTRIB_TOKEN 时走 GraphQL（含「公开显示的私有仓库」贡献），
// 否则或失败时回退公开抓取（仅公开仓库），再失败则返回空。
// 令牌读取：import.meta.env.GITHUB_CONTRIB_TOKEN ?? process.env.GITHUB_CONTRIB_TOKEN
// （Astro 构建与 Vite dev 都会读 .env.local）

// 构建期请求的超时：GitHub 偶尔挂起，超时后回退下一条路径，别把整个构建拖死
const REQUEST_TIMEOUT_MS = 5_000;

const LEVEL_MAP: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export type ContributionCell = { date: string; count: number; level: number };

const githubUser = GITHUB_REPO.split("/")[0];

async function fromGraphQL(
  token: string
): Promise<ContributionCell[][]> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks { contributionDays { date contributionCount contributionLevel } }
            }
          }
        }
      }`,
      variables: { login: githubUser },
    }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error("no calendar");
  // GraphQL 默认返回约一年；只取最近 26 周（半年），与公开抓取口径一致
  return cal.weeks
    .slice(-26)
    .map((w: any) =>
      w.contributionDays.map((d: any) => ({
        date: d.date,
        count: d.contributionCount,
        level: LEVEL_MAP[d.contributionLevel] ?? 0,
      }))
    );
}

async function fromScraper(): Promise<ContributionCell[][]> {
  const res = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${githubUser}`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`contributions API HTTP ${res.status}`);
  const data = await res.json();
  const list: ContributionCell[] = data.contributions ?? [];
  // 接口可能返回未来日期的占位数据，必须裁掉，否则窗口会被推到未来
  const today = new Date().toISOString().slice(0, 10);
  const past = list.filter((c) => c.date <= today);
  if (!past.length) return [];
  const byDate = new Map(past.map((c) => [c.date, c]));
  const dates = past.map((c) => c.date).sort();
  const end = new Date(dates[dates.length - 1] + "T00:00:00");
  const startSunday = new Date(end);
  startSunday.setDate(startSunday.getDate() - startSunday.getDay() - 25 * 7);
  const weekCount = 26;
  const grid: ContributionCell[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const col: ContributionCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(startSunday);
      dt.setDate(dt.getDate() + w * 7 + d);
      const key = dt.toISOString().slice(0, 10);
      const c = byDate.get(key);
      col.push({ date: key, count: c?.count ?? 0, level: c?.level ?? 0 });
    }
    grid.push(col);
  }
  return grid;
}

export interface ContributionResult {
  grid: ContributionCell[][];
  total: number | null;
}

// 模块级缓存：dev 下首页每次请求都会重新渲染，没有缓存就等于每次都打 GitHub。
// 失败结果也会被缓存（返回空网格），避免一次故障引发连续重试。
let cached: Promise<ContributionResult> | null = null;

/**
 * 拉取最近约 26 周（半年）贡献网格。返回空数组表示获取失败（调用方留空即可）。
 * 同一构建进程内只请求一次。
 */
export function fetchContributions(): Promise<ContributionResult> {
  cached ??= fetchContributionsUncached();
  return cached;
}

async function fetchContributionsUncached(): Promise<ContributionResult> {
  const token =
    import.meta.env.GITHUB_CONTRIB_TOKEN ?? process.env.GITHUB_CONTRIB_TOKEN;
  try {
    if (token) {
      const grid = await fromGraphQL(token);
      const total = grid.flat().reduce((s, c) => s + c.count, 0);
      console.log(`[heatmap] GraphQL ok, ${total} contributions (含私有仓库)`);
      return { grid, total };
    }
    console.warn("[heatmap] 未读到 GITHUB_CONTRIB_TOKEN，回退公开抓取");
  } catch (err) {
    console.warn(`[heatmap] 主路径失败，回退公开抓取：${err}`);
  }
  try {
    const grid = await fromScraper();
    const total = grid.flat().reduce((s, c) => s + c.count, 0);
    console.log(`[heatmap] 公开抓取 ok, ${total} contributions`);
    return { grid, total };
  } catch {
    console.warn("[heatmap] 公开抓取也失败，热力图留空");
    return { grid: [], total: null };
  }
}
