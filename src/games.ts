// Cấu hình các loại xổ số Vietlott.
// Dữ liệu lịch sử lấy từ repo vietvudanh/vietlott-data (tự cập nhật hàng ngày qua GitHub Actions).

const DATA_BASE =
  'https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data'

// BASE_URL của Vite ('./' khi build, '/' khi dev); fallback '/' để chạy được
// ngoài môi trường Vite (script test)
const BASE_URL: string =
  (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

export interface Tier {
  label: string
  rank: number
  prize: number | null // VND; với jackpot là mức khởi điểm tối thiểu
  minPrize?: boolean // true = giải cộng dồn, prize là mức tối thiểu
}

// Kiểu game: lotto = chọn số từ 1 bộ số (Mega/Power/Lotto 5/35);
// keno = chọn 1-10 số so với 20 số quay; digits = số 3 chữ số (Max 3D / Pro)
export type GameKind = 'lotto' | 'keno' | 'digits'

export interface Game {
  id: string
  name: string
  kind: GameKind
  url: string
  // Trang giới thiệu luật chơi & cơ cấu giải chính thức của Vietlott
  rulesUrl: string
  // Dữ liệu bổ sung đóng gói kèm app (các kỳ cũ mà nguồn GitHub thiếu)
  extraDataUrl?: string
  // File quá lớn (Keno ~12MB) thì không cache localStorage, chỉ giữ trong RAM
  noCache?: boolean
  maxNumber: number
  pickCount: number
  mainCount: number
  hasBonus: boolean // kết quả quay có thêm 1 bóng phụ sau dàn số chính
  bonusLabel: string | null
  // Màu bóng số phụ theo đúng Vietlott: 6/55 số vàng = vàng, 5/35 số may mắn = xanh lá
  bonusColor: 'gold' | 'green' | null
  bonusIcon: string
  // Người chơi phải chọn thêm 1 số từ bộ số riêng (Lotto 5/35: số may mắn 1–12)
  extraPick?: { label: string; max: number }
  // Vé bao: số lượng số tối đa được chọn theo luật Vietlott hiện hành
  // (Keno: số lượng số tối đa của bậc cao nhất)
  maxBao: number
  getTier(matched: number, bonusMatched: boolean, pickCount?: number): Tier | null
}

export interface Draw {
  date: string
  id: string
  result: number[]
}

export interface TierWin {
  tier: Tier
  count: number // số tổ hợp trúng giải này (vé thường luôn là 1)
}

export interface MatchResult {
  id: string
  date: string
  main: number[]
  bonus: number | null
  matchedNumbers: number[]
  matched: number
  bonusMatched: boolean
  tier: Tier | null // giải cao nhất trúng được
  tierWins: TierWin[] // toàn bộ giải trúng (vé bao có thể trúng nhiều giải)
  totalPrize: number // tổng tiền thưởng của cả vé
  totalIsMin: boolean // true = có giải cộng dồn nên tổng là mức tối thiểu
}

// ID kỳ quay có thể chứa ký tự thừa (Keno: "#0110271") → lấy phần số để so sánh
export function idNum(id: string): number {
  return parseInt(id.replace(/\D/g, ''), 10) || 0
}

// Bảng trả thưởng Keno chính thức (vé 10.000đ): KENO_TABLE[bậc][số trúng] = tiền
const KENO_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 20e3 },
  2: { 2: 90e3 },
  3: { 3: 200e3, 2: 20e3 },
  4: { 4: 400e3, 3: 50e3, 2: 10e3 },
  5: { 5: 4.4e6, 4: 50e3, 3: 10e3 },
  6: { 6: 12.5e6, 5: 450e3, 4: 40e3, 3: 10e3 },
  7: { 7: 40e6, 6: 1.2e6, 5: 100e3, 4: 20e3, 3: 10e3 },
  8: { 8: 200e6, 7: 5e6, 6: 500e3, 5: 50e3, 4: 20e3, 0: 10e3 },
  9: { 9: 800e6, 8: 12e6, 7: 1.5e6, 6: 150e3, 5: 30e3, 4: 10e3, 0: 10e3 },
  10: { 10: 2e9, 9: 150e6, 8: 7.4e6, 7: 600e3, 6: 80e3, 5: 20e3, 0: 10e3 },
}

export const GAMES: Game[] = [
  {
    id: 'power645',
    name: 'Mega 6/45',
    kind: 'lotto',
    url: `${DATA_BASE}/power645.jsonl`,
    rulesUrl: 'https://vietlott.vn/vi/choi/mega-6-45/gioi-thieu-san-pham-6-45',
    // Nguồn GitHub bắt đầu từ kỳ #00198; kỳ #001–#197 (2016–2017) được cào
    // một lần từ API Vietlott và đóng gói kèm app
    extraDataUrl: `${BASE_URL}data/power645-early.jsonl`,
    maxNumber: 45,
    pickCount: 6,
    mainCount: 6,
    hasBonus: false,
    bonusLabel: null,
    bonusColor: null,
    bonusIcon: '',
    maxBao: 18,
    getTier(matched) {
      if (matched === 6)
        return { label: 'Jackpot', rank: 1, prize: 12e9, minPrize: true }
      if (matched === 5) return { label: 'Giải nhất', rank: 2, prize: 10e6 }
      if (matched === 4) return { label: 'Giải nhì', rank: 3, prize: 300e3 }
      if (matched === 3) return { label: 'Giải ba', rank: 4, prize: 30e3 }
      return null
    },
  },
  {
    id: 'power655',
    name: 'Power 6/55',
    kind: 'lotto',
    url: `${DATA_BASE}/power655.jsonl`,
    rulesUrl:
      'https://vietlott.vn/vi/choi/power-6-55/gioi-thieu-san-pham-power-655',
    maxNumber: 55,
    pickCount: 6,
    mainCount: 6,
    hasBonus: true,
    bonusLabel: 'Số vàng',
    bonusColor: 'gold',
    bonusIcon: '⭐',
    maxBao: 18,
    getTier(matched, bonusMatched) {
      if (matched === 6)
        return { label: 'Jackpot 1', rank: 1, prize: 30e9, minPrize: true }
      if (matched === 5 && bonusMatched)
        return { label: 'Jackpot 2', rank: 2, prize: 3e9, minPrize: true }
      if (matched === 5) return { label: 'Giải nhất', rank: 3, prize: 40e6 }
      if (matched === 4) return { label: 'Giải nhì', rank: 4, prize: 500e3 }
      if (matched === 3) return { label: 'Giải ba', rank: 5, prize: 50e3 }
      return null
    },
  },
  {
    id: 'power535',
    name: 'Lotto 5/35',
    kind: 'lotto',
    url: `${DATA_BASE}/power535.jsonl`,
    rulesUrl: 'https://vietlott.vn/vi/choi/lotto535/gioi-thieu-san-pham-535',
    // Nguồn GitHub bị hổng 74 kỳ (crawler gián đoạn); đã cào bù một lần
    // từ API Vietlott và đóng gói kèm app
    extraDataUrl: `${BASE_URL}data/power535-missing.jsonl`,
    maxNumber: 35,
    pickCount: 5,
    mainCount: 5,
    hasBonus: true,
    bonusLabel: 'Số may mắn',
    bonusColor: 'green',
    bonusIcon: '🍀',
    extraPick: { label: 'Số may mắn', max: 12 },
    maxBao: 15,
    getTier(matched, bonusMatched) {
      if (matched === 5 && bonusMatched)
        return { label: 'Độc đắc', rank: 1, prize: 6e9, minPrize: true }
      if (matched === 5) return { label: 'Giải nhất', rank: 2, prize: 10e6 }
      if (matched === 4 && bonusMatched)
        return { label: 'Giải nhì', rank: 3, prize: 5e6 }
      if (matched === 4 || (matched === 3 && bonusMatched))
        return { label: 'Giải ba', rank: 4, prize: 500e3 }
      if (matched === 3) return { label: 'Giải tư', rank: 5, prize: 100e3 }
      if (matched >= 1 && bonusMatched)
        return { label: 'Giải năm', rank: 6, prize: 30e3 }
      if (bonusMatched)
        return { label: 'Khuyến khích', rank: 7, prize: 10e3 }
      return null
    },
  },
  {
    id: 'keno',
    name: 'Keno',
    kind: 'keno',
    url: `${DATA_BASE}/keno.jsonl`,
    rulesUrl: 'https://vietlott.vn/vi/choi/keno/gioi-thieu-san-pham-keno',
    noCache: true, // file ~12MB, vượt hạn mức localStorage
    maxNumber: 80,
    pickCount: 10, // bậc cao nhất; bậc thực tế = số lượng số người chơi chọn (1-10)
    mainCount: 20, // mỗi kỳ quay 20 số
    hasBonus: false,
    bonusLabel: null,
    bonusColor: null,
    bonusIcon: '',
    maxBao: 10, // không có vé bao, chỉ có bậc 1-10
    // Bảng thưởng cố định theo bậc: cần biết người chơi chọn mấy số
    getTier(matched, _bonusMatched, pickCount) {
      const k = pickCount ?? 10
      const prize = KENO_TABLE[k]?.[matched]
      if (prize === undefined) return null
      return {
        label:
          matched === 0 ? `An ủi (0/${k})` : `Trúng ${matched}/${k}`,
        // Cùng bậc: trúng nhiều số hơn = giải cao hơn
        rank: k - matched + 1,
        prize,
      }
    },
  },
]

export function getGame(id: string): Game {
  const game = GAMES.find((g) => g.id === id)
  if (!game) throw new Error(`Không có loại xổ số: ${id}`)
  return game
}

// ==========================================
// ĐỊNH DẠNG TIỀN THƯỞNG
// ==========================================

export function formatVND(value: number): string {
  if (value >= 1e9) {
    const ty = value / 1e9
    return `${Number.isInteger(ty) ? ty : ty.toFixed(1)} tỷ`
  }
  if (value >= 1e6) {
    const trieu = value / 1e6
    return `${Number.isInteger(trieu) ? trieu : trieu.toFixed(1)} triệu`
  }
  return `${value.toLocaleString('vi-VN')}đ`
}

// Format bộ số chuẩn để copy/dán: "06 17 23 24 32 42", Lotto 5/35 thêm " + 09"
// (bao số may mắn: " + 03 07 09")
export function formatPicks(
  numbers: number[],
  extra: number[] | number | null = null,
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const main = [...numbers].sort((a, b) => a - b).map(pad).join(' ')
  const extras = extra === null ? [] : Array.isArray(extra) ? extra : [extra]
  if (!extras.length) return main
  return `${main} + ${[...extras].sort((a, b) => a - b).map(pad).join(' ')}`
}

export function formatPrize(tier: Tier): string {
  if (tier.prize === null) return '—'
  const text = formatVND(tier.prize)
  return tier.minPrize ? `≥ ${text} (cộng dồn)` : text
}

// ==========================================
// TẢI DỮ LIỆU (có cache trong localStorage)
// ==========================================

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 giờ
const CACHE_VERSION = 'v3' // đổi khi format/nguồn dữ liệu thay đổi để bỏ cache cũ

function readCache(gameId: string): Draw[] | null {
  try {
    const raw = localStorage.getItem(`vietlott:${gameId}:${CACHE_VERSION}`)
    if (!raw) return null
    const { savedAt, draws } = JSON.parse(raw) as {
      savedAt: number
      draws: Draw[]
    }
    if (Date.now() - savedAt > CACHE_TTL_MS) return null
    return draws
  } catch {
    return null
  }
}

function writeCache(gameId: string, draws: Draw[]): void {
  try {
    localStorage.setItem(
      `vietlott:${gameId}:${CACHE_VERSION}`,
      JSON.stringify({ savedAt: Date.now(), draws }),
    )
  } catch {
    // localStorage đầy hoặc bị chặn thì bỏ qua, lần sau fetch lại
  }
}

function parseJsonl(text: string): Draw[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Draw
      } catch {
        return null
      }
    })
    .filter(
      (row): row is Draw =>
        row !== null && Array.isArray(row.result) && Boolean(row.id),
    )
}

export interface LoadResult {
  draws: Draw[]
  fromCache: boolean
}

// Cache trong RAM cho phiên hiện tại (Keno không lưu được localStorage vì quá lớn)
const memCache = new Map<string, Draw[]>()

export async function loadDraws(
  game: Game,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<LoadResult> {
  if (!forceRefresh) {
    const inMem = memCache.get(game.id)
    if (inMem) return { draws: inMem, fromCache: true }
    if (!game.noCache) {
      const cached = readCache(game.id)
      if (cached) {
        memCache.set(game.id, cached)
        return { draws: cached, fromCache: true }
      }
    }
  }

  const [res, extraRes] = await Promise.all([
    fetch(game.url),
    game.extraDataUrl
      ? fetch(game.extraDataUrl).catch(() => null)
      : Promise.resolve(null),
  ])
  if (!res.ok) {
    throw new Error(`Không tải được dữ liệu (HTTP ${res.status})`)
  }
  let draws = parseJsonl(await res.text())
  if (!draws.length) {
    throw new Error('Dữ liệu tải về rỗng hoặc sai định dạng')
  }

  // Ghép dữ liệu bổ sung (kỳ cũ); nguồn chính được ưu tiên khi trùng kỳ.
  // Thiếu file bổ sung thì vẫn chạy bình thường với nguồn chính.
  if (extraRes?.ok) {
    const extra = parseJsonl(await extraRes.text())
    const have = new Set(draws.map((d) => d.id))
    draws = [...draws, ...extra.filter((d) => !have.has(d.id))]
  }

  memCache.set(game.id, draws)
  if (!game.noCache) writeCache(game.id, draws)
  return { draws, fromCache: false }
}

// ==========================================
// SO KHỚP
// ==========================================

// Tổ hợp chập k của n
export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  k = Math.min(k, n - k)
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i
  }
  return Math.round(result)
}

// Vé bao = chơi mọi tổ hợp (bao số thường: mọi bộ pickCount số từ k số đã chọn;
// Lotto 5/35 bao số may mắn: 5 số thường × từng số may mắn đã chọn).
// Mỗi tổ hợp trúng giải độc lập và tiền thưởng được cộng dồn (luật Vietlott).
// Số tổ hợp trúng từng giải tính bằng toán tổ hợp, không cần duyệt từng tổ hợp.
export function matchDraw(
  game: Game,
  picks: number[],
  extraPicks: number[],
  draw: Draw,
): MatchResult {
  const main = draw.result.slice(0, game.mainCount)
  const bonus = game.hasBonus ? (draw.result[game.mainCount] ?? null) : null
  const matchedNumbers = picks.filter((n) => main.includes(n))
  const k = picks.length
  const m = matchedNumbers.length

  // Keno: không có tổ hợp/bao — tra thẳng bảng thưởng theo bậc (số lượng số đã chọn)
  if (game.kind === 'keno') {
    const tier = game.getTier(m, false, k)
    return {
      id: draw.id,
      date: draw.date,
      main,
      bonus: null,
      matchedNumbers,
      matched: m,
      bonusMatched: false,
      tier,
      tierWins: tier ? [{ tier, count: 1 }] : [],
      totalPrize: tier?.prize ?? 0,
      totalIsMin: false,
    }
  }

  // Lotto 5/35: số may mắn thuộc bộ số riêng, so với các số may mắn người chơi chọn.
  // Power 6/55: số vàng cùng bộ với 6 số chính, so với cả dàn số người chơi.
  const bonusMatched =
    bonus !== null &&
    (game.extraPick ? extraPicks.includes(bonus) : picks.includes(bonus))

  const winsByRank = new Map<number, TierWin>()
  const addWin = (tier: Tier | null, count: number) => {
    if (!tier || count <= 0) return
    const existing = winsByRank.get(tier.rank)
    if (existing) existing.count += count
    else winsByRank.set(tier.rank, { tier, count })
  }

  if (!game.hasBonus) {
    // Mega 6/45
    for (let j = 0; j <= game.pickCount; j++) {
      addWin(
        game.getTier(j, false),
        comb(m, j) * comb(k - m, game.pickCount - j),
      )
    }
  } else if (game.extraPick) {
    // Lotto 5/35: mỗi số may mắn đã chọn tạo 1 vệt tổ hợp riêng;
    // chỉ vệt chứa đúng số may mắn được quay là trúng phần số may mắn
    const luckyCount = Math.max(1, extraPicks.length)
    const luckyHits = bonusMatched ? 1 : 0
    for (let j = 0; j <= game.pickCount; j++) {
      const base = comb(m, j) * comb(k - m, game.pickCount - j)
      addWin(game.getTier(j, true), base * luckyHits)
      addWin(game.getTier(j, false), base * (luckyCount - luckyHits))
    }
  } else {
    // Power 6/55: số vàng nằm trong dàn số đã chọn thì chỉ các tổ hợp
    // chứa nó mới được tính là trúng số vàng
    const bonusInPicks = bonusMatched
    const others = k - m - (bonusInPicks ? 1 : 0)
    for (let j = 0; j <= game.pickCount; j++) {
      const withMatched = comb(m, j)
      if (bonusInPicks) {
        addWin(
          game.getTier(j, true),
          withMatched * comb(others, game.pickCount - 1 - j),
        )
      }
      addWin(
        game.getTier(j, false),
        withMatched * comb(others, game.pickCount - j),
      )
    }
  }

  const tierWins = [...winsByRank.values()].sort(
    (a, b) => a.tier.rank - b.tier.rank,
  )
  const totalPrize = tierWins.reduce(
    (sum, w) => sum + (w.tier.prize ?? 0) * w.count,
    0,
  )
  const totalIsMin = tierWins.some((w) => w.tier.minPrize)

  return {
    id: draw.id,
    date: draw.date,
    main,
    bonus,
    matchedNumbers,
    matched: m,
    bonusMatched,
    tier: tierWins[0]?.tier ?? null,
    tierWins,
    totalPrize,
    totalIsMin,
  }
}

export function searchDraws(
  game: Game,
  picks: number[],
  extraPicks: number[],
  draws: Draw[],
  { limit = 0 }: { limit?: number } = {},
): MatchResult[] {
  // Sắp kỳ mới nhất lên đầu rồi giới hạn số kỳ cần dò
  let scanned = [...draws].sort((a, b) => idNum(b.id) - idNum(a.id))
  if (limit > 0) scanned = scanned.slice(0, limit)

  const results = scanned.map((draw) =>
    matchDraw(game, picks, extraPicks, draw),
  )

  // Gần trúng nhất lên đầu: giải cao hơn > tổng tiền lớn hơn > nhiều số trùng hơn
  // > trúng số phụ > kỳ mới hơn
  results.sort((a, b) => {
    const rankA = a.tier?.rank ?? 100
    const rankB = b.tier?.rank ?? 100
    if (rankA !== rankB) return rankA - rankB
    if (b.totalPrize !== a.totalPrize) return b.totalPrize - a.totalPrize
    if (b.matched !== a.matched) return b.matched - a.matched
    if (a.bonusMatched !== b.bonusMatched) return a.bonusMatched ? -1 : 1
    return idNum(b.id) - idNum(a.id)
  })

  return results
}
