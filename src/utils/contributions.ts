import { GITHUB_REPO } from "../consts";

// GitHub 贡献热力图取数（构建时执行，烤进页面）。
// 有 GITHUB_CONTRIB_TOKEN 时走 GraphQL（含「公开显示的私有仓库」贡献），
// 否则或失败时回退公开抓取（仅公开仓库），再失败则返回空。
// 令牌读取：import.meta.env.GITHUB_CONTRIB_TOKEN ?? process.env.GITHUB_CONTRIB_TOKEN
// （Astro 构建与 Vite dev 都会读 .env.local）

const CAL_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
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
    `https://github-contributions-api.jogruber.de/v4/${githubUser}`
  );
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

/**
 * 拉取最近约 26 周（半年）贡献网格。返回空数组表示获取失败（调用方留空即可）。
 */
export async function fetchContributions(): Promise<{
  grid: ContributionCell[][];
  total: number | null;
}> {
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
