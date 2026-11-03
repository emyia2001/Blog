// 本文件由 scripts/sync-netease.mjs 自动生成，请勿手改。
// 重新生成：npm run sync:music
// 来源歌单：blog（id=18553197483）
// 生成时间：2026-11-03T01:40:24.548Z

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
  id: "18553197483",
  name: "blog",
  url: "https://music.163.com/#/playlist?id=18553197483",
  cover: "https://p1.music.126.net/ti-5yT4HNWJIgyFaJe8_HQ==/109951166875954827.jpg?param=600y600",
  generatedAt: "2026-11-03T01:40:24.548Z",
} as const;

export const MUSIC_ALBUMS: MusicAlbumGenerated[] = [
  {
    "albumId": 75062421,
    "title": "I beg you / 花びらたちのマーチ / Sailing",
    "creator": "Aimer",
    "year": 2019,
    "cover": "https://p1.music.126.net/ti-5yT4HNWJIgyFaJe8_HQ==/109951166875954827.jpg?param=600y600",
    "songId": 1338149091,
    "songName": "I beg you",
    "link": "https://music.163.com/#/album?id=75062421",
    "tracks": [
      {
        "songId": 1338149091,
        "songName": "I beg you"
      }
    ]
  },
  {
    "albumId": 52422,
    "title": "あなたに出会わなければ〜夏雪冬花〜/星屑ビーナス",
    "creator": "Aimer",
    "year": 2012,
    "cover": "https://p1.music.126.net/h056VieLWSGbg6zU9lkMWw==/109951166663284900.jpg?param=600y600",
    "songId": 560079,
    "songName": "あなたに出会わなければ~夏雪冬花~",
    "link": "https://music.163.com/#/album?id=52422",
    "tracks": [
      {
        "songId": 560079,
        "songName": "あなたに出会わなければ~夏雪冬花~"
      }
    ]
  },
  {
    "albumId": 52429,
    "title": "六等星の夜 / 悲しみはオーロラに / TWINKLE TWINKLE LITTLE STAR",
    "creator": "Aimer",
    "year": 2011,
    "cover": "https://p1.music.126.net/4ybgbPUCUcKnbjQZNpWf0w==/109951166918288985.jpg?param=600y600",
    "songId": 560139,
    "songName": "六等星の夜",
    "link": "https://music.163.com/#/album?id=52429",
    "tracks": [
      {
        "songId": 560139,
        "songName": "六等星の夜"
      }
    ]
  },
  {
    "albumId": 3211080,
    "title": "DAWN",
    "creator": "Aimer",
    "year": 2015,
    "cover": "https://p1.music.126.net/-NpYyW2ejTr7kcb-BxwsSg==/109951166919049170.jpg?param=600y600",
    "songId": 33418857,
    "songName": "LAST STARDUST",
    "link": "https://music.163.com/#/album?id=3211080",
    "tracks": [
      {
        "songId": 33418857,
        "songName": "LAST STARDUST"
      }
    ]
  },
  {
    "albumId": 34609370,
    "title": "ninelie EP",
    "creator": "Aimer",
    "year": 2016,
    "cover": "https://p1.music.126.net/g7aakYG_Wfmrn1_IDfVUXA==/109951165050166241.jpg?param=600y600",
    "songId": 409872504,
    "songName": "ninelie",
    "link": "https://music.163.com/#/album?id=34609370",
    "tracks": [
      {
        "songId": 409872504,
        "songName": "ninelie"
      }
    ]
  },
  {
    "albumId": 3154784,
    "title": "Brave Shine (期間生産限定アニメ盤)",
    "creator": "Aimer",
    "year": 2015,
    "cover": "https://p1.music.126.net/IX2EItaOWNbnY9fO7Tm2CQ==/109951168080741423.jpg?param=600y600",
    "songId": 32358691,
    "songName": "Brave Shine",
    "link": "https://music.163.com/#/album?id=3154784",
    "tracks": [
      {
        "songId": 32358691,
        "songName": "Brave Shine"
      }
    ]
  },
  {
    "albumId": 37256090,
    "title": "Ref:rain / 眩いばかり",
    "creator": "Aimer",
    "year": 2018,
    "cover": "https://p2.music.126.net/wAxnnUZnkN7Soqf7nhjThQ==/109951166663296887.jpg?param=600y600",
    "songId": 536623501,
    "songName": "Ref:rain",
    "link": "https://music.163.com/#/album?id=37256090",
    "tracks": [
      {
        "songId": 536623501,
        "songName": "Ref:rain"
      }
    ]
  },
  {
    "albumId": 2285010,
    "title": "世界",
    "creator": "逃跑计划",
    "year": 2011,
    "cover": "https://p2.music.126.net/625-tE8OzdM-rWO37PgqlQ==/109951168111472442.jpg?param=600y600",
    "songId": 25706282,
    "songName": "夜空中最亮的星",
    "link": "https://music.163.com/#/album?id=2285010",
    "tracks": [
      {
        "songId": 25706282,
        "songName": "夜空中最亮的星"
      },
      {
        "songId": 25706285,
        "songName": "再见,再见"
      },
      {
        "songId": 25706279,
        "songName": "一万次悲伤"
      }
    ]
  },
  {
    "albumId": 37546010,
    "title": "Closer (80s remix)",
    "creator": "TRONICBOX",
    "year": 2017,
    "cover": "https://p2.music.126.net/erc28WOzkAGuMgsBDOXfPA==/109951163134757045.jpg?param=600y600",
    "songId": 536098013,
    "songName": "Closer (80s Remix)",
    "link": "https://music.163.com/#/album?id=37546010",
    "tracks": [
      {
        "songId": 536098013,
        "songName": "Closer (80s Remix)"
      }
    ]
  },
  {
    "albumId": 35139581,
    "title": "CRADLE OF ETERNITY",
    "creator": "鈴華ゆう子",
    "year": 2016,
    "cover": "https://p2.music.126.net/XRszD1nA6wE8gCM74EnSuQ==/18690598162274789.jpg?param=600y600",
    "songId": 455502615,
    "songName": "永世のクレイドル",
    "link": "https://music.163.com/#/album?id=35139581",
    "tracks": [
      {
        "songId": 455502615,
        "songName": "永世のクレイドル"
      }
    ]
  },
  {
    "albumId": 2685303,
    "title": "莫后年代 莫文蔚20周年世纪典藏",
    "creator": "莫文蔚",
    "year": 2013,
    "cover": "https://p2.music.126.net/lAn76HMjRiiWJawCZ0kCNA==/109951165884867482.jpg?param=600y600",
    "songId": 27937429,
    "songName": "盛夏的果实",
    "link": "https://music.163.com/#/album?id=2685303",
    "tracks": [
      {
        "songId": 27937429,
        "songName": "盛夏的果实"
      }
    ]
  },
  {
    "albumId": 84238505,
    "title": "death bed (coffee for your head)",
    "creator": "Powfu / beabadoobee",
    "year": 2020,
    "cover": "https://p2.music.126.net/NLvxrDAeRtM3sJtspYok3w==/109951165988499274.jpg?param=600y600",
    "songId": 1410815174,
    "songName": "death bed (coffee for your head)",
    "link": "https://music.163.com/#/album?id=84238505",
    "tracks": [
      {
        "songId": 1410815174,
        "songName": "death bed (coffee for your head)"
      }
    ]
  },
  {
    "albumId": 73478802,
    "title": "SPIRAL",
    "creator": "She Her Her Hers",
    "year": 2018,
    "cover": "https://p2.music.126.net/wboW3wGxFvgGm8ad3WSfSQ==/109951163559799123.jpg?param=600y600",
    "songId": 1311429332,
    "songName": "SPIRAL",
    "link": "https://music.163.com/#/album?id=73478802",
    "tracks": [
      {
        "songId": 1311429332,
        "songName": "SPIRAL"
      }
    ]
  },
  {
    "albumId": 3439746,
    "title": "#ラブリーミュージック",
    "creator": "ラブリーサマーちゃん",
    "year": 2018,
    "cover": "https://p2.music.126.net/DjSKs4P36usnm-HQNIJkuQ==/109951167355126236.jpg?param=600y600",
    "songId": 40915404,
    "songName": "私の好きなもの",
    "link": "https://music.163.com/#/album?id=3439746",
    "tracks": [
      {
        "songId": 40915404,
        "songName": "私の好きなもの"
      },
      {
        "songId": 40915402,
        "songName": "はじめまして"
      },
      {
        "songId": 40915401,
        "songName": "Intro"
      },
      {
        "songId": 40915405,
        "songName": "ルミネセンス"
      }
    ]
  },
  {
    "albumId": 122058533,
    "title": "Secret Base but is it okay if it's lofi?",
    "creator": "Kijugo",
    "year": 2021,
    "cover": "https://p2.music.126.net/Psu9fV1iFrSiiZcAT7lg3w==/109951165655894051.jpg?param=600y600",
    "songId": 1814430459,
    "songName": "Secret Base but is it okay if it's lofi?",
    "link": "https://music.163.com/#/album?id=122058533",
    "tracks": [
      {
        "songId": 1814430459,
        "songName": "Secret Base but is it okay if it's lofi?"
      }
    ]
  },
  {
    "albumId": 123718729,
    "title": "One Last Kiss",
    "creator": "宇多田ヒカル",
    "year": 2021,
    "cover": "https://p2.music.126.net/l3G4LigZnOxFE9lB4bz_LQ==/109951165791860501.jpg?param=600y600",
    "songId": 1824020871,
    "songName": "One Last Kiss",
    "link": "https://music.163.com/#/album?id=123718729",
    "tracks": [
      {
        "songId": 1824020871,
        "songName": "One Last Kiss"
      }
    ]
  },
  {
    "albumId": 47826,
    "title": "「医龍 Team Medical Dragon」オリジナルサウンドトラック",
    "creator": "澤野弘之",
    "year": 2006,
    "cover": "https://p2.music.126.net/-WDIg7wxkNIL7Cuypx8PHQ==/2520080650879496.jpg?param=600y600",
    "songId": 501829,
    "songName": "Blue Dragon(piano&guitarver)",
    "link": "https://music.163.com/#/album?id=47826",
    "tracks": [
      {
        "songId": 501829,
        "songName": "Blue Dragon(piano&guitarver)"
      }
    ]
  },
  {
    "albumId": 131924570,
    "title": "老人と海",
    "creator": "ヨルシカ",
    "year": 2021,
    "cover": "https://p2.music.126.net/5aHcGADR5i6biE5TSqf_aQ==/109951166295171725.jpg?param=600y600",
    "songId": 1870469768,
    "songName": "老人と海",
    "link": "https://music.163.com/#/album?id=131924570",
    "tracks": [
      {
        "songId": 1870469768,
        "songName": "老人と海"
      }
    ]
  },
  {
    "albumId": 34841090,
    "title": "君の名は。",
    "creator": "RADWIMPS",
    "year": 2016,
    "cover": "https://p2.music.126.net/UoHin_i29CVJr4gKPEY1kQ==/109951171836647530.jpg?param=600y600",
    "songId": 426881480,
    "songName": "夢灯籠",
    "link": "https://music.163.com/#/album?id=34841090",
    "tracks": [
      {
        "songId": 426881480,
        "songName": "夢灯籠"
      },
      {
        "songId": 426881500,
        "songName": "三葉のテーマ"
      }
    ]
  },
  {
    "albumId": 82922118,
    "title": "location",
    "creator": "She Her Her Hers",
    "year": 2019,
    "cover": "https://p2.music.126.net/_dOB2qcmlOABN2fwo0a-Cw==/109951164483665299.jpg?param=600y600",
    "songId": 1400424646,
    "songName": "Episode 33",
    "link": "https://music.163.com/#/album?id=82922118",
    "tracks": [
      {
        "songId": 1400424646,
        "songName": "Episode 33"
      },
      {
        "songId": 1400424017,
        "songName": "Bloody Mary Girl"
      }
    ]
  },
  {
    "albumId": 1489044,
    "title": "Living Room Songs",
    "creator": "Ólafur Arnalds",
    "year": 2011,
    "cover": "https://p2.music.126.net/v2355rBKjGrilTP85LLoNQ==/109951164434740509.jpg?param=600y600",
    "songId": 16139397,
    "songName": "This Place Is a Shelter",
    "link": "https://music.163.com/#/album?id=1489044",
    "tracks": [
      {
        "songId": 16139397,
        "songName": "This Place Is a Shelter"
      }
    ]
  },
  {
    "albumId": 55940,
    "title": "空の境界 Vol.2 殺人考察(前)",
    "creator": "梶浦由記",
    "year": 2008,
    "cover": "https://p2.music.126.net/8evxqelgme7kUAph_DxyQA==/3191882255508479.jpg?param=600y600",
    "songId": 591797,
    "songName": "M01",
    "link": "https://music.163.com/#/album?id=55940",
    "tracks": [
      {
        "songId": 591797,
        "songName": "M01"
      }
    ]
  },
  {
    "albumId": 55831,
    "title": "the Garden of sinners －劇場版「空の境界」音楽集－",
    "creator": "梶浦由記",
    "year": 2011,
    "cover": "https://p2.music.126.net/rSHwTfMV8d2WcXP80-U-bg==/109951171371820441.jpg?param=600y600",
    "songId": 590464,
    "songName": "in the garden of sinners",
    "link": "https://music.163.com/#/album?id=55831",
    "tracks": [
      {
        "songId": 590464,
        "songName": "in the garden of sinners"
      }
    ]
  },
  {
    "albumId": 98418475,
    "title": "Cyberpunk 2077: Radio, Vol. 2 (Original Soundtrack)",
    "creator": "Various Artists",
    "year": 2020,
    "cover": "https://p2.music.126.net/ETNtwbJ4s1oCNXAyr_YEYQ==/109951170504647739.jpg?param=600y600",
    "songId": 1496089152,
    "songName": "I Really Want to Stay at Your House",
    "link": "https://music.163.com/#/album?id=98418475",
    "tracks": [
      {
        "songId": 1496089152,
        "songName": "I Really Want to Stay at Your House"
      }
    ]
  },
  {
    "albumId": 176180843,
    "title": "Killswitch Lullaby",
    "creator": "flawed mangoes",
    "year": 2023,
    "cover": "https://p2.music.126.net/JDgRwse7iQ_3Z8csYrf89A==/109951168961871868.jpg?param=600y600",
    "songId": 2087776231,
    "songName": "Killswitch Lullaby",
    "link": "https://music.163.com/#/album?id=176180843",
    "tracks": [
      {
        "songId": 2087776231,
        "songName": "Killswitch Lullaby"
      }
    ]
  },
  {
    "albumId": 80592085,
    "title": "seen 11:23 pm",
    "creator": "mj apanay",
    "year": 2019,
    "cover": "https://p2.music.126.net/b15pmn1qj28nyam8DdcCHA==/109951167480966719.jpg?param=600y600",
    "songId": 1379918404,
    "songName": "time machine (feat. aren park)",
    "link": "https://music.163.com/#/album?id=80592085",
    "tracks": [
      {
        "songId": 1379918404,
        "songName": "time machine (feat. aren park)"
      }
    ]
  },
  {
    "albumId": 82411890,
    "title": "Exit",
    "creator": "Kylo",
    "year": 2019,
    "cover": "https://p2.music.126.net/8DhkeCL0lhPOPgCqZ_WL0A==/109951164427352606.jpg?param=600y600",
    "songId": 1396953203,
    "songName": "Tell You",
    "link": "https://music.163.com/#/album?id=82411890",
    "tracks": [
      {
        "songId": 1396953203,
        "songName": "Tell You"
      }
    ]
  },
  {
    "albumId": 78779323,
    "title": "This Is The One",
    "creator": "宇多田ヒカル",
    "year": 2009,
    "cover": "https://p2.music.126.net/tMhfrzn5tIsNelc1fQbvKw==/109951173397201047.jpg?param=600y600",
    "songId": 1361336636,
    "songName": "Come Back To Me",
    "link": "https://music.163.com/#/album?id=78779323",
    "tracks": [
      {
        "songId": 1361336636,
        "songName": "Come Back To Me"
      }
    ]
  },
  {
    "albumId": 275479057,
    "title": "waiting...",
    "creator": "Juliana Chahayed",
    "year": 2025,
    "cover": "https://p2.music.126.net/zQwJPixUIg2IaUdG_sBDdg==/109951174020056328.jpg?param=600y600",
    "songId": 2716515487,
    "songName": "waiting...",
    "link": "https://music.163.com/#/album?id=275479057",
    "tracks": [
      {
        "songId": 2716515487,
        "songName": "waiting..."
      }
    ]
  },
  {
    "albumId": 253246197,
    "title": "雨夹雪（end）",
    "creator": "Seto",
    "year": 2024,
    "cover": "https://p2.music.126.net/TBEzhMXj53IhKXMWSbLjfg==/109951170132740470.jpg?param=600y600",
    "songId": 2644724736,
    "songName": "雨夹雪（end）",
    "link": "https://music.163.com/#/album?id=253246197",
    "tracks": [
      {
        "songId": 2644724736,
        "songName": "雨夹雪（end）"
      }
    ]
  },
  {
    "albumId": 372875410,
    "title": "你的泪 我的雨季",
    "creator": "Seto",
    "year": 2026,
    "cover": "https://p2.music.126.net/t0WAeqEqDAthvHXoO_xHww==/109951173117296925.jpg?param=600y600",
    "songId": 3374424995,
    "songName": "你的泪 我的雨季",
    "link": "https://music.163.com/#/album?id=372875410",
    "tracks": [
      {
        "songId": 3374424995,
        "songName": "你的泪 我的雨季"
      }
    ]
  },
  {
    "albumId": 30544,
    "title": "泪海",
    "creator": "许茹芸",
    "year": 1996,
    "cover": "https://p2.music.126.net/TougJlCvAbS1wf6M3kif6w==/109951172702570259.jpg?param=600y600",
    "songId": 307594,
    "songName": "泪海",
    "link": "https://music.163.com/#/album?id=30544",
    "tracks": [
      {
        "songId": 307594,
        "songName": "泪海"
      }
    ]
  },
  {
    "albumId": 175073407,
    "title": "剧集狂想曲",
    "creator": "群星",
    "year": 2023,
    "cover": "https://p2.music.126.net/Uj1wy8qXjaWH0m8m1BLG8A==/109951168925897589.jpg?param=600y600",
    "songId": 2083393312,
    "songName": "两杯茶 (HKTV \"来生不做香港人\"主题曲)",
    "link": "https://music.163.com/#/album?id=175073407",
    "tracks": [
      {
        "songId": 2083393312,
        "songName": "两杯茶 (HKTV \"来生不做香港人\"主题曲)"
      }
    ]
  },
  {
    "albumId": 55519,
    "title": "心ばかり",
    "creator": "KOKIA",
    "year": 2012,
    "cover": "https://p2.music.126.net/L2xTj7NKQ1UdMjCXXnVWvg==/109951164515041644.jpg?param=600y600",
    "songId": 587778,
    "songName": "クルマレテ",
    "link": "https://music.163.com/#/album?id=55519",
    "tracks": [
      {
        "songId": 587778,
        "songName": "クルマレテ"
      }
    ]
  },
  {
    "albumId": 84263790,
    "title": "i love u [all]",
    "creator": "Seto",
    "year": 2019,
    "cover": "https://p2.music.126.net/JYd5XgzZ3mLCbYh8fsitUA==/109951172363724474.jpg?param=600y600",
    "songId": 1411258523,
    "songName": "luv u 2",
    "link": "https://music.163.com/#/album?id=84263790",
    "tracks": [
      {
        "songId": 1411258523,
        "songName": "luv u 2"
      }
    ]
  },
  {
    "albumId": 3102826,
    "title": "色",
    "creator": "FLOWER FLOWER",
    "year": 2015,
    "cover": "https://p2.music.126.net/FZ-WocHseUUXsWvj5f3H9Q==/109951169169580173.jpg?param=600y600",
    "songId": 30590331,
    "songName": "秋",
    "link": "https://music.163.com/#/album?id=3102826",
    "tracks": [
      {
        "songId": 30590331,
        "songName": "秋"
      }
    ]
  },
  {
    "albumId": 47821,
    "title": "魔法使いの夜 オリジナルサウンドトラック",
    "creator": "深澤秀行 / 芳賀敬太",
    "year": 2012,
    "cover": "https://p2.music.126.net/mmnd2-wzKU0aIRnzBsGQFQ==/109951170530147837.jpg?param=600y600",
    "songId": 501859,
    "songName": "innocence",
    "link": "https://music.163.com/#/album?id=47821",
    "tracks": [
      {
        "songId": 501859,
        "songName": "innocence"
      },
      {
        "songId": 501660,
        "songName": "久遠寺有珠"
      },
      {
        "songId": 501673,
        "songName": "静希草十郎"
      }
    ]
  },
  {
    "albumId": 16932,
    "title": "梦游计",
    "creator": "许嵩",
    "year": 2012,
    "cover": "https://p2.music.126.net/7X3irAHmXIkyZKu1OzDZdQ==/109951172321460834.jpg?param=600y600",
    "songId": 167655,
    "songName": "幻听",
    "link": "https://music.163.com/#/album?id=16932",
    "tracks": [
      {
        "songId": 167655,
        "songName": "幻听"
      }
    ]
  }
];
