/**
 * 「拾集」页的收藏数据。
 *
 * 说明：
 * - 示例占位数据，换成自己喜欢的条目即可；每类条数不限，页面自动统计。
 * - 「书籍」包含书籍与漫画（已合并）。
 * - 「音乐」的数据由 `npm run sync:music` 从网易云公开歌单生成
 *   （见 `src/data/music.generated.ts`，勿手改），这里只做字段映射。
 * - 展示方式：书籍 → 立体书架；音乐 → 专辑墙；电影 / 电视剧 → 封面墙。
 */
import { MUSIC_ALBUMS } from "./music.generated";

export interface CollectionItem {
  title: string;
  creator: string;
  year: number;
  hue: number;
  note: string;
  /** 封面图（音乐为网易云封面，其余可放 img.snarkm.com 或外链） */
  cover?: string;
  /** 外链：点击卡片跳转（音乐 → 网易云专辑播放页） */
  link?: string;
  /** 详情弹层里的内容简介（比 note 更长，可留空） */
  desc?: string;
  /** 评分（10 分制）与评价人数；ratingSource 标注来源，如「豆瓣」「Bangumi」 */
  rating?: number;
  ratingCount?: number;
  ratingSource?: string;
  /** 出版/上映信息（出版社或制片国家 / 年月或上映日 / 页数或片长、集数） */
  press?: string;
  pubdate?: string;
  pages?: string;
  /** 简介来源（维基百科条目 URL，用于署名） */
  descSource?: string;
  /** 网易云专辑 ID（音乐分类，由同步脚本写入） */
  albumId?: number;
  /** 这张专辑在歌单里的全部曲目（音乐分类，弹窗里列出） */
  tracks?: { id: number; name: string }[];
}

export interface CollectionCategory {
  id: string;
  label: string;
  en: string;
  items: CollectionItem[];
}

export const COLLECTION: CollectionCategory[] = [
  {
    id: "books",
    label: "书籍",
    en: "Books",
    items: [
      // —— 书籍 ——
      { title: "朝花夕拾", creator: "鲁迅", year: 1928, hue: 350, note: "", cover: "/images/covers/books/chao-hua-xi-shi.jpg", link: "https://book.douban.com/subject/1449352/", desc: "《朝花夕拾》，原名《旧事重提》。是鲁迅的短篇回忆录集，收录了鲁迅在1928年间所写的回忆录十篇。包括《狗·猫·鼠》、《阿长与〈山海经〉》、《二十四孝图》、《无常》、《从百草园到三味书屋》等，1932年由北新书局出版。1990年代人民文学出版社出版《鲁迅全集》时收在第2卷。", descSource: "https://zh.wikipedia.org/wiki/%E6%9C%9D%E8%8A%B1%E5%A4%95%E6%8B%BE", rating: 9.1, ratingCount: 176756, ratingSource: "豆瓣", press: "人民文学出版社", pubdate: "1973-4", pages: "92" },
      { title: "白夜行", creator: "东野圭吾", year: 1999, hue: 214, note: "", cover: "/images/covers/books/bai-ye-xing.jpg", link: "https://book.douban.com/subject/10554308/", desc: "《白夜行》（日语：白夜行，びゃくやこう）是日本作家东野圭吾的长篇推理小说。1997年1月至1999年1月连载于集英社《小説すばる》，单行本由集英社于1999年8月发行，日本销售量超过200万本。英文版译名《Journey Under the Midnight Sun》。\n2005年被改编为舞台剧，2006年被改编为电视剧，2009、2011年分别于韩国和日本被改编电影。", descSource: "https://zh.wikipedia.org/wiki/%E7%99%BD%E5%A4%9C%E8%A1%8C", rating: 9.2, ratingCount: 545553, ratingSource: "豆瓣", press: "南海出版公司", pubdate: "2013-1", pages: "538" },
      { title: "恶意", creator: "东野圭吾", year: 1996, hue: 214, note: "", cover: "/images/covers/books/e-yi.jpg", link: "https://book.douban.com/subject/3646172/", desc: "《恶意》（日语：悪意）是日本作家东野圭吾的长篇推理小说，也是“加贺恭一郎系列”的第四本小说。单行本于1996年由双叶社发行，2001年发行了讲谈社文库版。英文版译名《Malice : A Mystery》。", descSource: "https://zh.wikipedia.org/wiki/%E6%83%A1%E6%84%8F_(%E5%B0%8F%E8%AA%AA)", rating: 8.5, ratingCount: 246314, ratingSource: "豆瓣", press: "南海出版公司", pubdate: "2009-6", pages: "264" },
      { title: "我与地坛", creator: "史铁生", year: 2002, hue: 150, note: "安静时重读，总能被稳稳接住。", cover: "/images/covers/books/wo-yu-di-tan.jpg", link: "https://book.douban.com/subject/30207170/", desc: "《我与地坛》是中国作家史铁生的抒情散文，首次发表于1991年1月的《上海文学》杂志。该文第一和第二部分被收入人民教育出版社的高中一年级教材中。", descSource: "https://zh.wikipedia.org/wiki/%E6%88%91%E4%B8%8E%E5%9C%B0%E5%9D%9B", rating: 9.2, ratingCount: 10497, ratingSource: "豆瓣", press: "人民文学出版社", pubdate: "2018-4", pages: "270" },
      // —— 漫画 ——
      { title: "蓦然回首", creator: "藤本树", year: 2021, hue: 330, note: "", cover: "/images/covers/books/mo-ran-hui-shou.jpg", link: "https://book.douban.com/subject/35801543/", desc: "《蓦然回首》（日语：ルックバック，罗马化：Rukku Bakku，英语：Look Back）是日本漫画家藤本树于2021年7月19日在集英社的漫画平台网站少年Jump+上发表的单篇作品。内容描写着在小学时期里常在校内报纸上创作漫画的藤野，就读中学后开始与欣赏她才能的友人京本一同画漫画，但在长大成人时面临到与京本生离死别的种种经历。\n此篇漫画发表后在网络上获得许多回响，并成为少年Jump+网站上首部能在一天里达到200多万阅览次数的作品。动画电影版于2024年6月28日上映，在第97届奥斯卡金像奖最佳动画片奖入围初选名单，但未进入决选。真人电影版于2026年9月11日上映。", descSource: "https://zh.wikipedia.org/wiki/%E9%A9%80%E7%84%B6%E5%9B%9E%E9%A6%96_(%E6%BC%AB%E7%95%AB)", rating: 8.7, ratingCount: 23372, ratingSource: "豆瓣", press: "新星出版社", pubdate: "2022-8", pages: "144" },
      { title: "链锯人", creator: "藤本树", year: 2018, hue: 45, note: "荒诞、暴力，又意外真诚。", cover: "/images/covers/books/lian-ju-ren.jpg", link: "https://mangadex.org/title/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b", desc: "《电锯人》（日语：チェンソーマン，英语：Chainsaw Man，香港和台湾译作“链锯人”）是由日本漫画家藤本树所创作的黑暗奇幻少年漫画，该作于2018年12月3日发售的《周刊少年Jump》2019年第1号开始连载，这也是藤本树首度在该杂志连载的作品。故事主要描述一名斩杀恶魔维生的少年——电次，经历意外后重生并获得了“链锯恶魔”的力量，从此加入公安部门与各式恶魔交战。\n《电锯人》获得《这本漫画真厉害！2021》男生篇第一名、第66届小学馆漫画奖少年向部门等奖项。截至2024年12月，漫画累计发行量突破3000万本。\n漫画的第一部“公安篇”于《周刊少年Jump》2021年第2号完结，并于同期宣布第二部将于集英社旗下的网上漫画平台少年Jump+上连载；第二部“学园篇”已于2022年7月13日开始连载，并于2026年3月25日完结。\n改编电视动画第一季已于2022年10月11日起在东京电视台播映，共12集。动画版续作《电锯人剧场版：蕾塞篇》于2023年12月17日宣布以剧场版形式制作，并已于2025年9月19日起在世界各地上映。", descSource: "https://zh.wikipedia.org/wiki/%E9%8F%88%E9%8B%B8%E4%BA%BA", rating: 7.9, ratingCount: 6938, ratingSource: "Bangumi", press: "集英社（日版）", pubdate: "2018 年起连载" },
    ],
  },
  {
    id: "music",
    label: "音乐",
    en: "Music",
    // 由 `npm run sync:music` 从网易云歌单「blog」生成：按专辑分组（同专辑多首歌收在 tracks 里），顺序即歌单顺序。
    items: MUSIC_ALBUMS.map((album) => ({
      title: album.title,
      creator: album.creator,
      year: album.year,
      hue: 0,
      note: "",
      cover: album.cover,
      link: album.link,
      albumId: album.albumId,
      tracks: album.tracks.map((t) => ({ id: t.songId, name: t.songName })),
    })),
  },
  {
    id: "movies",
    label: "电影",
    en: "Films",
    items: [
      { title: "流浪地球2", creator: "郭帆", year: 2023, hue: 0, note: "", cover: "/images/covers/films/liulang-earth-2.jpg", link: "https://movie.douban.com/subject/35267208/", desc: "《流浪地球2》是2023年上映的中国大陆科幻电影，影片改编自刘慈欣的小说《流浪地球》，由郭帆执导、刘慈欣担任监制，吴京及李雪健领衔主演，刘德华特别出演。本片是2019年电影《流浪地球》的前传，叙述人类为应对太阳急速老化膨胀以致吞没太阳系的危机，决定并执行将地球迁移至半人马座α的计划（“流浪地球/移山”计划）的故事。\n本片于2021年10月至2022年3月期间开机拍摄，2022年下半年进入后期特效制作阶段，2023年1月22日（农历大年初一）上映，获得许多好评以及40.43亿人民币高票房，票房最高时总额位列中国内地最高电影票房第十名，目前在中国电影票房排行榜上位列第12位。电影代表中国内地角逐第96届奥斯卡金像奖最佳国际影片奖。续集《流浪地球3》预定2027年推出。", descSource: "https://zh.wikipedia.org/wiki/%E6%B5%81%E6%B5%AA%E5%9C%B0%E7%90%832", rating: 8.3, ratingCount: 1431835, ratingSource: "豆瓣", press: "中国大陆", pubdate: "2023-01-22", pages: "173 分钟" },
      { title: "你的名字。", creator: "新海诚", year: 2016, hue: 0, note: "", cover: "/images/covers/films/your-name.jpg", link: "https://movie.douban.com/subject/26683290/", desc: "《你的名字。》（日语：君の名は。）是一部2016年日本动画爱情奇幻片，由新海诚编剧兼执导，2016年8月26日于日本首映。影片由田中将贺担任人物设计，作画导演为安藤雅司，剧中音乐则由摇滚乐团RADWIMPS负责制作，影星神木隆之介与上白石萌音分别为片中男女主角配音。本作与《天气之子》、《铃芽之旅》被称作新海诚的“灾难三部曲”，故事叙述居住在东京的少年立花泷与糸守町出身的少女宫水三叶，偶然发现彼此的意识会互换至对方身上后，所延伸的连串奇异际遇，该作品亦和作者新海诚2019年发行的《天气之子》故事有交岔关系。\n本作是新海诚第一次采用制作委员会方式的作品。该片上映后连霸日本数周票房冠军，日本与海外地区的票房总和达4.05亿美元，成为新海诚执导生涯中最高票房成绩的作品。电影发行后佳评如潮，媒体和影评家赞誉电影里的视觉艺术、动画、音乐、角色魅力和情感张力。本片获得西班牙锡切斯电影节最佳动画长片奖等电影奖荣誉。衍生作品《小说 你的名字》荣获2017年SUGOI JAPAN Award娱乐小说部门首奖。本作获得的广泛回响带动了电影相关地点的观光业发展，还被收录进日本于2023年审核通过、2024年启用的小学五年道德教科书（文部科学省审定教科书），列为介绍日本传统文化里的动画领域范例作品之一。", descSource: "https://zh.wikipedia.org/wiki/%E4%BD%A0%E7%9A%84%E5%90%8D%E5%AD%97%E3%80%82", rating: 8.5, ratingCount: 1625543, ratingSource: "豆瓣", press: "日本", pubdate: "2016-12-02", pages: "106 分钟" },
      { title: "天气之子", creator: "新海诚", year: 2019, hue: 0, note: "", cover: "/images/covers/films/weathering-with-you.jpg", link: "https://movie.douban.com/subject/30402296/", desc: "《天气之子》（日语：天気の子，英语：Weathering With You）是日本动画导演新海诚编剧及执导的动画电影，于2019年7月19日在日本上映。本片由CoMix Wave Films制作，并是新海诚继《你的名字。》之后第二次与东宝合作发行。本片的剧情带有奇幻和浪漫元素，讲述离家少男与可以使天气放晴的少女邂逅的故事，作品世界观和新海诚的前作《你的名字。》有交岔关系。本片同时是新海诚继《你的名字。》后，第二部有关灾难主题的动画电影，与《你的名字》和《铃芽之旅》合称“灾难三部曲”。\n新海诚在完成《你的名字。》后，以引发观众共鸣为动机，选择了“天气”这一主题，并宣称这会是一部不迎合普遍价值观、评价两极的电影。他在2017年2月提出了剧本的雏型，同年7月开始执笔剧本。本片的人物设计和配乐分别由《你的名字。》田中将贺和RADWIMPS再次担任，美术监督则由《言叶之庭》泷口比吕志担任。原本作画监督会由《你的名字。》的安藤雅司担任，但因抽不出身而由田村笃取代。剧组于2018年5月起进行动画的作画工程，2019年7月全片完成。\n本片在日本上映之后，获得超过140亿日圆的票房，为该国影史第21名（截至2026年6月），新海诚也成为继宫崎骏之后第二位有两部作品获得百亿日圆票房的日本动画导演。然而正如新海诚所宣称，外界对《天气之子》的看法两极，分歧主要出现在对主角的行为和剧情的认同程度，动画品质和配乐则普遍得到好评。本片代表日本角逐第92届奥斯卡金像奖最佳国际影片，并入选最佳动画长片的候选名单，但最终都未能入围。", descSource: "https://zh.wikipedia.org/wiki/%E5%A4%A9%E6%B0%94%E4%B9%8B%E5%AD%90", rating: 7.0, ratingCount: 480347, ratingSource: "豆瓣", press: "日本", pubdate: "2019-11-01", pages: "112 分钟" },
      { title: "铃芽之旅", creator: "新海诚", year: 2022, hue: 0, note: "", cover: "/images/covers/films/suzume.jpg", link: "https://movie.douban.com/subject/35371261/", desc: "《铃芽之旅》（日语：すずめの戸締まり）是由新海诚编剧兼执导的日本动画电影，于2022年11月11日在日本国内上映、隔年春季在海外上映。本片为新海诚第8部动画电影，也是他继《你的名字。》《天气之子》后，第三部牵涉灾难题材的电影，三片合称作新海诚的“灾难三部曲”。故事讲述少女岩户铃芽、与以关闭灾难之门为使命的“闭门师”宗像草太，为了关闭灾难之门展开一连串的冒险旅程。影片前导标语为“门的那一边，存在着一切的时间——”（扉の向こうには、すべての時間があった——），正式海报标语为“我出发了。”（行ってきます。）\n新海诚创作本片的灵感，源自工作前往日本各地期间看见人口减少绿地增加、2019冠状病毒病疫情期间发现原为闹区的东京新宿变得寂静的现象，构思电影和小说剧情时融入东日本大震灾的事件。本片为新海诚首度采用公路电影形式创作的作品，故事舞台贯穿日本列岛，遍及九州的宫崎县、四国的爱媛县、神户、东京、东北的宫城县及岩手县等地。\n本片发行后，成为新海诚第三部日本国内票房超过100亿日圆的作品，获得外界正面为主的评价；媒体与影评界称赞视觉动画、场景描写、配乐、人物情感、直面东日本大震灾的议题，评论观点分歧主要针对主角的行动、男女主角的关系刻画，片中描绘灾难生物型体的形象、与《你的名字。》和《天气之子》相似的剧情结构则受到部分影评家诟病。电影入围第73届柏林电影节主竞赛单元、第81届金球奖最佳动画奖，在第46届日本电影学院奖获颁优秀动画奖、最优秀音乐奖，参演该片的松村北斗赢得该届话题演员奖。第51届安妮奖与宫崎骏执导的《你想活出怎样的人生》并列7项奖项提名，成为日本动画电影历年入围安妮奖奖项数目之最。该片还让相关取景地成为观光景点。", descSource: "https://zh.wikipedia.org/wiki/%E9%88%B4%E8%8A%BD%E4%B9%8B%E6%97%85", rating: 7.2, ratingCount: 511255, ratingSource: "豆瓣", press: "日本", pubdate: "2023-03-24", pages: "121 分钟" },
      { title: "命运之夜——天之杯Ⅰ：恶兆之花", creator: "须藤友德", year: 2017, hue: 0, note: "", cover: "/images/covers/films/heavens-feel-1.jpg", link: "https://movie.douban.com/subject/25937991/", desc: "三部曲第一部，副标题「I. presage flower」（恶兆之花）。《命运之夜——天之杯》是ufotable制作的动画电影，由须藤友德导演和桧山彬编剧，梶浦由记负责配乐。改编自TYPE-MOON的视觉小说《Fate/stay night》的第三条路线，也是最后一条路线《Heaven's Feel》（天之杯）。共分为三部分播映，第一章《I.presage flower》（恶兆之花）于2017年10月14日上映。第二章《II.lost butterfly》（迷失之蝶）于2019年1月12日上映。第三章《III.spring song》（春之歌）于2020年8月15日上映。\n这是ufotable继剧场版《空之境界》系列、电视动画《Fate/Zero》和电视动画《命运之夜：无限剑制》后，第四度改编自TYPE-MOON的动画作品。亦是《Fate/stay night》在推出以第一路线“Fate”为主轴，混合了其他两线内容的2006年电视动画《Fate/stay night》，改编自第二路线“Unlimited Blade Works”（无限剑制）路线的2010年剧场版动画《命运之夜 剧场版》及2014年电视动画《命运之夜：无限剑制》之后，第三路线“Heaven's Feel”（天之杯）首次登上银幕剧场版化。", descSource: "https://zh.wikipedia.org/wiki/Fate/stay_night_Heaven%27s_Feel", rating: 7.4, ratingCount: 42671, ratingSource: "豆瓣", press: "日本", pubdate: "2019-01-11", pages: "120 分钟" },
      { title: "命运之夜——天之杯Ⅱ：迷失之蝶", creator: "须藤友德", year: 2019, hue: 0, note: "", cover: "/images/covers/films/heavens-feel-2.jpg", link: "https://movie.douban.com/subject/26759819/", desc: "三部曲第二部，副标题「II. lost butterfly」（迷失之蝶）。《命运之夜——天之杯》是ufotable制作的动画电影，由须藤友德导演和桧山彬编剧，梶浦由记负责配乐。改编自TYPE-MOON的视觉小说《Fate/stay night》的第三条路线，也是最后一条路线《Heaven's Feel》（天之杯）。共分为三部分播映，第一章《I.presage flower》（恶兆之花）于2017年10月14日上映。第二章《II.lost butterfly》（迷失之蝶）于2019年1月12日上映。第三章《III.spring song》（春之歌）于2020年8月15日上映。\n这是ufotable继剧场版《空之境界》系列、电视动画《Fate/Zero》和电视动画《命运之夜：无限剑制》后，第四度改编自TYPE-MOON的动画作品。亦是《Fate/stay night》在推出以第一路线“Fate”为主轴，混合了其他两线内容的2006年电视动画《Fate/stay night》，改编自第二路线“Unlimited Blade Works”（无限剑制）路线的2010年剧场版动画《命运之夜 剧场版》及2014年电视动画《命运之夜：无限剑制》之后，第三路线“Heaven's Feel”（天之杯）首次登上银幕剧场版化。", descSource: "https://zh.wikipedia.org/wiki/Fate/stay_night_Heaven%27s_Feel", rating: 7.5, ratingCount: 37017, ratingSource: "豆瓣", press: "日本", pubdate: "2019-07-12", pages: "117 分钟" },
      { title: "命运之夜——天之杯Ⅲ：春之歌", creator: "须藤友德", year: 2020, hue: 0, note: "", cover: "/images/covers/films/heavens-feel-3.jpg", link: "https://movie.douban.com/subject/26759820/", desc: "三部曲第三部，副标题「III. spring song」（春之歌）。《命运之夜——天之杯》是ufotable制作的动画电影，由须藤友德导演和桧山彬编剧，梶浦由记负责配乐。改编自TYPE-MOON的视觉小说《Fate/stay night》的第三条路线，也是最后一条路线《Heaven's Feel》（天之杯）。共分为三部分播映，第一章《I.presage flower》（恶兆之花）于2017年10月14日上映。第二章《II.lost butterfly》（迷失之蝶）于2019年1月12日上映。第三章《III.spring song》（春之歌）于2020年8月15日上映。\n这是ufotable继剧场版《空之境界》系列、电视动画《Fate/Zero》和电视动画《命运之夜：无限剑制》后，第四度改编自TYPE-MOON的动画作品。亦是《Fate/stay night》在推出以第一路线“Fate”为主轴，混合了其他两线内容的2006年电视动画《Fate/stay night》，改编自第二路线“Unlimited Blade Works”（无限剑制）路线的2010年剧场版动画《命运之夜 剧场版》及2014年电视动画《命运之夜：无限剑制》之后，第三路线“Heaven's Feel”（天之杯）首次登上银幕剧场版化。", descSource: "https://zh.wikipedia.org/wiki/Fate/stay_night_Heaven%27s_Feel", rating: 8.5, ratingCount: 24574, ratingSource: "豆瓣", press: "日本", pubdate: "2020-08-15", pages: "122 分钟" },
    ],
  },
  {
    id: "tv",
    label: "电视剧",
    en: "Series",
    items: [
      { title: "漫长的季节", creator: "辛爽", year: 2023, hue: 0, note: "", cover: "/images/covers/films/long-season.jpg", link: "https://movie.douban.com/subject/35588177/", desc: "《漫长的季节》（英语：The Long Season）是一部中国大陆生活悬疑电视剧，由企鹅影视（Tencent Penguin Pictures）出品，辛爽执导，范伟、秦昊、陈明昊领衔主演，李庚希、刘奕铁、蒋奇明等特别演出。该剧于2023年4月22日在腾讯视频首播，后于2024年2月至3月在江苏卫视及东方卫视电视台播出。。\n2023年4月22日在腾讯视频独播。2024年2月11日起每晚19:30在江苏卫视幸福剧场播出。\n《漫长的季节》讲述发生在虚构东北工业小城“桦林”的一桩碎尸悬案，透过多个角色在近20年（1997、1998及2016年）时间线上的交错叙述，展现案件背后的人性、生活变迁与社会现实。剧情以出租车被套牌事件为引线，引出18年前的旧案及多个人物的命运变化。", descSource: "https://zh.wikipedia.org/wiki/%E6%BC%AB%E9%95%BF%E7%9A%84%E5%AD%A3%E8%8A%82", rating: 9.4, ratingCount: 1205052, ratingSource: "豆瓣", press: "中国大陆", pubdate: "2023-04-22", pages: "12 集" },
    ],
  },
];

export const COLLECTION_TOTAL = COLLECTION.reduce((sum, cat) => sum + cat.items.length, 0);
