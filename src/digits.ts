// Max 3D / Max 3D+ / Max 3D Pro — game dạng số 3 chữ số (000-999).
// Dữ liệu: result là object theo hạng giải, mỗi kỳ quay 20 bộ ba số:
// "Giải Đặc biệt" (2), "Giải Nhất" (4), "Giải Nhì" (6), "Giải ba" (8).
import { idNum, type Tier } from './games.ts'

const DATA_BASE =
  'https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data'

export interface DigitDraw {
  date: string
  id: string
  // Số theo hạng giải, đã chuẩn hoá thứ tự: [ĐB, Nhất, Nhì, Ba]
  tiers: string[][]
}

export type DigitPlayMode = 'max3d-basic' | 'max3d-plus' | 'max3dpro'

export interface DigitGame {
  id: string
  name: string
  url: string
  rulesUrl: string
  // Các kiểu chơi khả dụng trên cùng một kỳ quay (đều chọn 2 số 3 chữ số)
  modes: {
    value: DigitPlayMode
    label: string
    desc: string
  }[]
}

export const DIGIT_GAMES: DigitGame[] = [
  {
    id: 'max3d',
    name: 'Max 3D',
    url: `${DATA_BASE}/3d.jsonl`,
    rulesUrl: 'https://vietlott.vn/vi/choi/max3d/gioi-thieu-san-pham-max3d',
    modes: [
      {
        value: 'max3d-basic',
        label: 'Max 3D cơ bản',
        desc: 'Chọn 2 số 3 chữ số — mỗi số dự thưởng ĐỘC LẬP, chỉ cần trúng 1 trong 2. Số xuất hiện ở nhiều hạng giải thì tiền thưởng cộng dồn tất cả.',
      },
      {
        value: 'max3d-plus',
        label: 'Max 3D+',
        desc: 'Chọn 2 số 3 chữ số dự thưởng THEO CẶP. Trúng cả 2 số ở giải Đặc biệt ăn 1 tỷ; mỗi vé nhận 1 giải cao nhất.',
      },
    ],
  },
  {
    id: 'max3dpro',
    name: 'Max 3D Pro',
    url: `${DATA_BASE}/3d_pro.jsonl`,
    rulesUrl:
      'https://vietlott.vn/vi/choi/max3dpro/gioi-thieu-san-pham-max3dpro',
    modes: [
      {
        value: 'max3dpro',
        label: 'Max 3D Pro',
        desc: 'Chọn 2 số 3 chữ số dự thưởng THEO CẶP. Trúng 2 số Đặc biệt ĐÚNG THỨ TỰ ăn 2 tỷ, ngược thứ tự ăn 400 triệu; mỗi vé nhận 1 giải cao nhất.',
      },
    ],
  },
]

export function getDigitGame(id: string): DigitGame {
  const game = DIGIT_GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`Không có loại xổ số: ${id}`)
  return game
}

export const DIGIT_TIER_NAMES = ['Giải Đặc biệt', 'Giải Nhất', 'Giải Nhì', 'Giải Ba']

// Sắp kỳ mới nhất lên đầu
export function idNumSort(draws: DigitDraw[]): DigitDraw[] {
  return [...draws].sort((a, b) => idNum(b.id) - idNum(a.id))
}

// ==========================================
// TẢI & PARSE DỮ LIỆU
// ==========================================

const memCache = new Map<string, DigitDraw[]>()

function normalizeDraw(row: {
  date?: string
  id?: string
  result?: Record<string, string[]>
}): DigitDraw | null {
  if (!row?.date || !row.id || !row.result || typeof row.result !== 'object')
    return null
  // Tên hạng giải trong data viết hoa/thường không đồng nhất ("Giải ba")
  const findTier = (needle: string) => {
    const key = Object.keys(row.result!).find(
      (k) => k.toLowerCase() === needle.toLowerCase(),
    )
    const value = key ? row.result![key] : []
    return Array.isArray(value)
      ? value.map((s) => String(s).padStart(3, '0'))
      : []
  }
  const tiers = [
    findTier('Giải Đặc biệt'),
    findTier('Giải Nhất'),
    findTier('Giải Nhì'),
    findTier('Giải Ba'),
  ]
  if (tiers.every((t) => t.length === 0)) return null
  return { date: row.date, id: row.id, tiers }
}

export async function loadDigitDraws(
  game: DigitGame,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<{ draws: DigitDraw[]; fromCache: boolean }> {
  if (!forceRefresh) {
    const inMem = memCache.get(game.id)
    if (inMem) return { draws: inMem, fromCache: true }
  }

  const res = await fetch(game.url)
  if (!res.ok) throw new Error(`Không tải được dữ liệu (HTTP ${res.status})`)
  const text = await res.text()
  const draws = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeDraw(JSON.parse(line))
      } catch {
        return null
      }
    })
    .filter((d): d is DigitDraw => d !== null)
  if (!draws.length) throw new Error('Dữ liệu tải về rỗng hoặc sai định dạng')

  memCache.set(game.id, draws)
  return { draws, fromCache: false }
}

// ==========================================
// SO KHỚP
// ==========================================

export interface DigitMatch {
  id: string
  date: string
  tiers: string[][]
  tier: Tier | null // giải cao nhất
  tierWins: { tier: Tier; count: number }[]
  totalPrize: number
  // Các số quay thưởng trùng với vé (để tô đậm): "tierIndex:position"
  hitKeys: Set<string>
}

// Đếm số lần xuất hiện của một số trong một hạng giải
const countIn = (list: string[], num: string) =>
  list.filter((x) => x === num).length

// Vị trí trúng để tô đậm trên UI
function collectHits(tiers: string[][], nums: string[]): Set<string> {
  const hits = new Set<string>()
  tiers.forEach((list, ti) =>
    list.forEach((x, pi) => {
      if (nums.includes(x)) hits.add(`${ti}:${pi}`)
    }),
  )
  return hits
}

// --- Max 3D cơ bản: 1-2 số, MỖI SỐ dự thưởng độc lập, cộng dồn mọi lần xuất hiện ---
const MAX3D_PRIZES = [1e6, 350e3, 210e3, 100e3]
const MAX3D_LABELS = ['Đặc biệt', 'Giải nhất', 'Giải nhì', 'Giải ba']

function matchMax3DBasic(picks: string[], draw: DigitDraw): DigitMatch {
  const tierWins: { tier: Tier; count: number }[] = []
  let totalPrize = 0
  draw.tiers.forEach((list, i) => {
    // Mỗi số đã chọn so độc lập với hạng giải; chọn 2 số giống nhau = 2 lần dự thưởng
    const count = picks.reduce((sum, pick) => sum + countIn(list, pick), 0)
    if (count > 0) {
      tierWins.push({
        tier: { label: MAX3D_LABELS[i], rank: i + 1, prize: MAX3D_PRIZES[i] },
        count,
      })
      totalPrize += MAX3D_PRIZES[i] * count
    }
  })
  return {
    id: draw.id,
    date: draw.date,
    tiers: draw.tiers,
    tier: tierWins[0]?.tier ?? null,
    tierWins,
    totalPrize,
    hitKeys: collectHits(draw.tiers, picks),
  }
}

// --- Ghép cặp: kiểm tra cả 2 số cùng trùng trong MỘT hạng giải (theo multiset:
// nếu chọn 2 số giống nhau thì hạng đó phải chứa số ấy ít nhất 2 lần) ---
function bothInTier(list: string[], a: string, b: string): boolean {
  if (a === b) return countIn(list, a) >= 2
  return countIn(list, a) >= 1 && countIn(list, b) >= 1
}

// Trả về giải cao nhất cho kiểu chơi 2 số (Max 3D+ / Max 3D Pro):
// mỗi vé chỉ nhận 1 giải cao nhất theo luật Vietlott.
function matchPair(
  a: string,
  b: string,
  draw: DigitDraw,
  cfg: {
    // [prize ĐB cả cặp, phụ ĐB (Pro), nhất, nhì, ba, tư khác hạng, năm 1 số ĐB, sáu 1 số khác]
    special: number
    subSpecial: number | null // Pro: ngược thứ tự; Max 3D+ không có
    first: number
    second: number
    third: number
    fourth: number
    fifth: number
    sixth: number
    ordered: boolean // Pro: ĐB phải đúng thứ tự
  },
): DigitMatch {
  const [db, nhat, nhi, ba] = draw.tiers
  let tier: Tier | null = null

  const inTier = (num: string) => [
    countIn(db, num) > 0,
    countIn(nhat, num) > 0,
    countIn(nhi, num) > 0,
    countIn(ba, num) > 0,
  ]
  const aIn = inTier(a)
  const bIn = inTier(b)
  const aAny = aIn.some(Boolean)
  const bAny = bIn.some(Boolean)

  if (cfg.ordered) {
    // Max 3D Pro: đúng thứ tự / ngược thứ tự với 2 số giải Đặc biệt
    if (a === db[0] && b === db[1]) {
      tier = { label: 'Đặc biệt', rank: 1, prize: cfg.special }
    } else if (cfg.subSpecial !== null && a === db[1] && b === db[0]) {
      tier = { label: 'Phụ đặc biệt', rank: 2, prize: cfg.subSpecial }
    }
  } else if (bothInTier(db, a, b)) {
    // Max 3D+: trùng cả 2 số ĐB, không cần thứ tự
    tier = { label: 'Đặc biệt', rank: 1, prize: cfg.special }
  }

  if (!tier && bothInTier(nhat, a, b))
    tier = { label: 'Giải nhất', rank: 3, prize: cfg.first }
  if (!tier && bothInTier(nhi, a, b))
    tier = { label: 'Giải nhì', rank: 4, prize: cfg.second }
  if (!tier && bothInTier(ba, a, b))
    tier = { label: 'Giải ba', rank: 5, prize: cfg.third }

  // Giải tư: 2 số trúng ở 2 hạng giải KHÁC NHAU
  if (!tier && aAny && bAny) {
    const differentTiers = aIn.some((hit, i) => hit && bIn.some((h2, j) => h2 && i !== j))
    if (differentTiers)
      tier = { label: 'Giải tư', rank: 6, prize: cfg.fourth }
  }

  // Giải năm: chỉ 1 số trúng và số đó thuộc giải Đặc biệt
  if (!tier && (aAny || bAny)) {
    if (aIn[0] || bIn[0]) {
      tier = { label: 'Giải năm', rank: 7, prize: cfg.fifth }
    } else {
      // Giải sáu: 1 số trúng giải Nhất/Nhì/Ba
      tier = { label: 'Giải sáu', rank: 8, prize: cfg.sixth }
    }
  }

  return {
    id: draw.id,
    date: draw.date,
    tiers: draw.tiers,
    tier,
    tierWins: tier ? [{ tier, count: 1 }] : [],
    totalPrize: tier?.prize ?? 0,
    hitKeys: collectHits(draw.tiers, [a, b]),
  }
}

export function matchDigitDraw(
  mode: DigitPlayMode,
  picks: string[],
  draw: DigitDraw,
): DigitMatch {
  if (mode === 'max3d-basic') return matchMax3DBasic(picks, draw)
  if (mode === 'max3d-plus')
    return matchPair(picks[0], picks[1], draw, {
      special: 1e9,
      subSpecial: null,
      first: 40e6,
      second: 10e6,
      third: 5e6,
      fourth: 1e6,
      fifth: 150e3,
      sixth: 40e3,
      ordered: false,
    })
  return matchPair(picks[0], picks[1], draw, {
    special: 2e9,
    subSpecial: 400e6,
    first: 30e6,
    second: 10e6,
    third: 4e6,
    fourth: 1e6,
    fifth: 100e3,
    sixth: 40e3,
    ordered: true,
  })
}

export function searchDigitDraws(
  mode: DigitPlayMode,
  picks: string[],
  draws: DigitDraw[],
  { limit = 0 }: { limit?: number } = {},
): DigitMatch[] {
  let scanned = [...draws].sort((a, b) => idNum(b.id) - idNum(a.id))
  if (limit > 0) scanned = scanned.slice(0, limit)

  const results = scanned.map((d) => matchDigitDraw(mode, picks, d))
  results.sort((a, b) => {
    const rankA = a.tier?.rank ?? 100
    const rankB = b.tier?.rank ?? 100
    if (rankA !== rankB) return rankA - rankB
    if (b.totalPrize !== a.totalPrize) return b.totalPrize - a.totalPrize
    return idNum(b.id) - idNum(a.id)
  })
  return results
}

// ==========================================
// THỐNG KÊ
// ==========================================

export interface DigitNumberStat {
  number: string
  count: number
  lastDate: string | null
}

// Tần suất từng chữ số 0-9 theo vị trí (hàng trăm/chục/đơn vị) — mặc định chỉ
// tính giải Đặc biệt để có ý nghĩa; allTiers=true tính cả 20 số.
export function computeDigitPositionStats(
  draws: DigitDraw[],
  { allTiers = false } = {},
): number[][] {
  // [vị trí 0..2][chữ số 0..9] = số lần
  const stats = Array.from({ length: 3 }, () => new Array<number>(10).fill(0))
  for (const d of draws) {
    const nums = allTiers ? d.tiers.flat() : d.tiers[0]
    for (const num of nums) {
      for (let pos = 0; pos < 3; pos++) {
        const digit = num.charCodeAt(pos) - 48
        if (digit >= 0 && digit <= 9) stats[pos][digit]++
      }
    }
  }
  return stats
}

// Top bộ ba số ra nhiều nhất (tính cả 20 số mỗi kỳ)
export function computeDigitNumberStats(
  draws: DigitDraw[],
  limit = 0,
): { stats: DigitNumberStat[]; totalDraws: number } {
  let scanned = [...draws].sort((a, b) => idNum(b.id) - idNum(a.id))
  if (limit > 0) scanned = scanned.slice(0, limit)

  const count = new Map<string, number>()
  const lastDate = new Map<string, string>()
  scanned.forEach((d) => {
    for (const num of d.tiers.flat()) {
      count.set(num, (count.get(num) ?? 0) + 1)
      if (!lastDate.has(num)) lastDate.set(num, d.date) // scanned mới → cũ
    }
  })

  const stats: DigitNumberStat[] = [...count.entries()]
    .map(([number, c]) => ({
      number,
      count: c,
      lastDate: lastDate.get(number) ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.number.localeCompare(b.number))

  return { stats, totalDraws: scanned.length }
}
