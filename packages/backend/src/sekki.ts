/**
 * Sekki (節気) — current Japanese solar term, derived from today's date.
 * No external data needed; the 24 terms are fixed by the solar calendar.
 */

interface SekkiInfo {
  number: number
  kanji: string
  romaji: string
  english: string
  startMonth: number
  startDay: number
  /** menu item keywords that are in season this period */
  seasonalKeywords: string[]
}

const SEKKI: SekkiInfo[] = [
  { number: 1,  kanji: '小寒', romaji: 'Shōkan',  english: 'Minor Cold',        startMonth: 1,  startDay: 5,  seasonalKeywords: ['yellowtail', 'buri', 'komatsuna', 'lotus root', 'nabe', 'hot pot'] },
  { number: 2,  kanji: '大寒', romaji: 'Daikan',  english: 'Major Cold',        startMonth: 1,  startDay: 20, seasonalKeywords: ['yellowtail', 'buri', 'carrot', 'daikon', 'miso', 'nabe'] },
  { number: 3,  kanji: '立春', romaji: 'Risshun', english: 'Start of Spring',   startMonth: 2,  startDay: 4,  seasonalKeywords: ['clam', 'nanohana', 'butterbur', 'fuki', 'sardine'] },
  { number: 4,  kanji: '雨水', romaji: 'Usui',    english: 'Rain Water',        startMonth: 2,  startDay: 19, seasonalKeywords: ['clam', 'asari', 'nanohana', 'spring onion'] },
  { number: 5,  kanji: '啓蟄', romaji: 'Keichitsu',english: 'Insects Awaken',   startMonth: 3,  startDay: 6,  seasonalKeywords: ['mugwort', 'yomogi', 'bamboo shoot', 'takenoko', 'seri'] },
  { number: 6,  kanji: '春分', romaji: 'Shunbun', english: 'Spring Equinox',    startMonth: 3,  startDay: 21, seasonalKeywords: ['udo', 'spring onion', 'bamboo shoot', 'sakura', 'cherry'] },
  { number: 7,  kanji: '清明', romaji: 'Seimei',  english: 'Clear and Bright',  startMonth: 4,  startDay: 5,  seasonalKeywords: ['bamboo shoot', 'takenoko', 'new onion', 'spring cabbage', 'sakura'] },
  { number: 8,  kanji: '穀雨', romaji: 'Kokuu',   english: 'Grain Rain',        startMonth: 4,  startDay: 20, seasonalKeywords: ['bamboo shoot', 'new tea', 'matcha', 'green tea', 'spring vegetables'] },
  { number: 9,  kanji: '立夏', romaji: 'Rikka',   english: 'Start of Summer',   startMonth: 5,  startDay: 6,  seasonalKeywords: ['bonito', 'katsuo', 'new onion', 'asparagus', 'broad bean'] },
  { number: 10, kanji: '小満', romaji: 'Shōman',  english: 'Grain Buds',        startMonth: 5,  startDay: 21, seasonalKeywords: ['bonito', 'katsuo', 'green plum', 'ume', 'barley', 'mugi'] },
  { number: 11, kanji: '芒種', romaji: 'Bōshu',   english: 'Grain in Ear',      startMonth: 6,  startDay: 6,  seasonalKeywords: ['plum', 'ume', 'firefly squid', 'hotaru ika', 'ajisai', 'octopus'] },
  { number: 12, kanji: '夏至', romaji: 'Geshi',   english: 'Summer Solstice',   startMonth: 6,  startDay: 21, seasonalKeywords: ['octopus', 'tako', 'ginger', 'shoga', 'myoga', 'edamame'] },
  { number: 13, kanji: '小暑', romaji: 'Shōsho',  english: 'Minor Heat',        startMonth: 7,  startDay: 7,  seasonalKeywords: ['eel', 'unagi', 'somen', 'cold noodles', 'watermelon', 'tomato'] },
  { number: 14, kanji: '大暑', romaji: 'Taisho',  english: 'Major Heat',        startMonth: 7,  startDay: 23, seasonalKeywords: ['eel', 'unagi', 'somen', 'cold noodles', 'edamame', 'cucumber'] },
  { number: 15, kanji: '立秋', romaji: 'Risshū',  english: 'Start of Autumn',   startMonth: 8,  startDay: 7,  seasonalKeywords: ['sweetfish', 'ayu', 'corn', 'early autumn', 'nashi pear'] },
  { number: 16, kanji: '処暑', romaji: 'Shosho',  english: 'End of Heat',       startMonth: 8,  startDay: 23, seasonalKeywords: ['saury', 'sanma', 'matsutake', 'mushroom', 'eggplant', 'nasu'] },
  { number: 17, kanji: '白露', romaji: 'Hakuro',  english: 'White Dew',         startMonth: 9,  startDay: 8,  seasonalKeywords: ['saury', 'sanma', 'pear', 'nashi', 'grape', 'mushroom'] },
  { number: 18, kanji: '秋分', romaji: 'Shūbun',  english: 'Autumn Equinox',    startMonth: 9,  startDay: 23, seasonalKeywords: ['sweet potato', 'satsumaimo', 'chestnut', 'kuri', 'dango', 'new rice'] },
  { number: 19, kanji: '寒露', romaji: 'Kanro',   english: 'Cold Dew',          startMonth: 10, startDay: 8,  seasonalKeywords: ['chestnut', 'kuri', 'matsutake', 'new sake', 'persimmon', 'kaki'] },
  { number: 20, kanji: '霜降', romaji: 'Sōkō',    english: "Frost's Descent",   startMonth: 10, startDay: 23, seasonalKeywords: ['persimmon', 'kaki', 'new rice', 'mushroom', 'burdock', 'gobo'] },
  { number: 21, kanji: '立冬', romaji: 'Rittō',   english: 'Start of Winter',   startMonth: 11, startDay: 7,  seasonalKeywords: ['nabe', 'hot pot', 'ginkgo', 'ginnan', 'yellowtail', 'buri', 'oyster'] },
  { number: 22, kanji: '小雪', romaji: 'Shōsetsu',english: 'Minor Snow',        startMonth: 11, startDay: 22, seasonalKeywords: ['daikon', 'mandarin', 'mikan', 'oyster', 'kaki', 'nabe'] },
  { number: 23, kanji: '大雪', romaji: 'Taisetsu',english: 'Major Snow',        startMonth: 12, startDay: 7,  seasonalKeywords: ['crab', 'kani', 'yellowtail', 'buri', 'salmon', 'sake', 'nabe'] },
  { number: 24, kanji: '冬至', romaji: 'Tōji',    english: 'Winter Solstice',   startMonth: 12, startDay: 22, seasonalKeywords: ['pumpkin', 'kabocha', 'yuzu', 'citrus', 'lotus root', 'renkon'] },
]

export function getCurrentSekki(date = new Date()): SekkiInfo {
  const month = date.getMonth() + 1
  const day   = date.getDate()

  // Find the last sekki whose start date is ≤ today
  let current = SEKKI[SEKKI.length - 1]
  for (const s of SEKKI) {
    if (month > s.startMonth || (month === s.startMonth && day >= s.startDay)) {
      current = s
    }
  }
  return current
}

export function tagMenuItems<T extends { name: string; nameJa?: string }>(
  items: T[],
  sekki: SekkiInfo,
): (T & { inSeason: boolean })[] {
  return items.map(item => {
    const haystack = `${item.name} ${item.nameJa ?? ''}`.toLowerCase()
    const inSeason = sekki.seasonalKeywords.some(kw => haystack.includes(kw.toLowerCase()))
    return { ...item, inSeason }
  })
}

export type { SekkiInfo }
