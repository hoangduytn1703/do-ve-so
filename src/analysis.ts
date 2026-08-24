// Thống kê tần suất và dự đoán số (chỉ để giải trí).
import type { Draw, Game } from './games.ts'

export function sortDrawsNewest(draws: Draw[]): Draw[] {
  return [...draws].sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10))
}

const pad = (n: number) => String(n).padStart(2, '0')

// ==========================================
// THỐNG KÊ TẦN SUẤT
// ==========================================

export interface NumberStat {
  number: number
  count: number
  percent: number // % kỳ có số này trong dàn số chính
  lastDate: string | null
  gap: number | null // đã bao nhiêu kỳ chưa ra (0 = ra ở kỳ mới nhất, null = chưa ra lần nào)
}

export interface StatsResult {
  stats: NumberStat[]
  totalDraws: number
}

export function computeStats(
  game: Game,
  draws: Draw[],
  limit = 0,
): StatsResult {
  let scanned = sortDrawsNewest(draws)
  if (limit > 0) scanned = scanned.slice(0, limit)

  const count = new Array<number>(game.maxNumber + 1).fill(0)
  const lastIndex = new Array<number>(game.maxNumber + 1).fill(-1)
  const lastDate = new Array<string | null>(game.maxNumber + 1).fill(null)

  scanned.forEach((draw, idx) => {
    for (const n of draw.result.slice(0, game.mainCount)) {
      if (n >= 1 && n <= game.maxNumber) {
        count[n]++
        if (lastIndex[n] === -1) {
          lastIndex[n] = idx
          lastDate[n] = draw.date
        }
      }
    }
  })

  const stats: NumberStat[] = []
  for (let n = 1; n <= game.maxNumber; n++) {
    stats.push({
      number: n,
      count: count[n],
      percent: scanned.length ? (count[n] / scanned.length) * 100 : 0,
      lastDate: lastDate[n],
      gap: lastIndex[n] === -1 ? null : lastIndex[n],
    })
  }
  return { stats, totalDraws: scanned.length }
}

// Thống kê riêng cho số đặc biệt: bóng phụ sau dàn số chính
// (6/55: số vàng 1–55, Lotto 5/35: số may mắn 1–12)
export function computeExtraStats(
  game: Game,
  draws: Draw[],
  limit = 0,
): StatsResult | null {
  if (!game.hasBonus) return null
  let scanned = sortDrawsNewest(draws)
  if (limit > 0) scanned = scanned.slice(0, limit)

  const max = game.extraPick?.max ?? game.maxNumber
  const count = new Array<number>(max + 1).fill(0)
  const lastIndex = new Array<number>(max + 1).fill(-1)
  const lastDate = new Array<string | null>(max + 1).fill(null)

  scanned.forEach((draw, idx) => {
    const n = draw.result[game.mainCount]
    if (n !== undefined && n >= 1 && n <= max) {
      count[n]++
      if (lastIndex[n] === -1) {
        lastIndex[n] = idx
        lastDate[n] = draw.date
      }
    }
  })

  const stats: NumberStat[] = []
  for (let n = 1; n <= max; n++) {
    stats.push({
      number: n,
      count: count[n],
      percent: scanned.length ? (count[n] / scanned.length) * 100 : 0,
      lastDate: lastDate[n],
      gap: lastIndex[n] === -1 ? null : lastIndex[n],
    })
  }
  return { stats, totalDraws: scanned.length }
}

// ==========================================
// DỰ ĐOÁN SỐ (cho vui!)
// ==========================================

export type PredictMethod =
  | 'avg'
  | 'max-pos'
  | 'min-pos'
  | 'most-freq'
  | 'least-freq'

export const PREDICT_METHODS: {
  value: PredictMethod
  label: string
  desc: string
}[] = [
  {
    value: 'avg',
    label: 'Trung bình cộng theo vị trí',
    desc: 'Xếp mỗi kỳ từ nhỏ đến lớn, lấy trung bình cộng của từng vị trí trong N kỳ gần nhất.',
  },
  {
    value: 'max-pos',
    label: 'Số lớn nhất ở từng vị trí',
    desc: 'Xếp mỗi kỳ từ nhỏ đến lớn, lấy số lớn nhất từng xuất hiện ở từng vị trí.',
  },
  {
    value: 'min-pos',
    label: 'Số nhỏ nhất ở từng vị trí',
    desc: 'Xếp mỗi kỳ từ nhỏ đến lớn, lấy số nhỏ nhất từng xuất hiện ở từng vị trí.',
  },
  {
    value: 'most-freq',
    label: 'Số ra nhiều nhất',
    desc: 'Chọn các số xuất hiện nhiều lần nhất trong N kỳ gần nhất.',
  },
  {
    value: 'least-freq',
    label: 'Số ra ít nhất',
    desc: 'Chọn các số xuất hiện ít lần nhất (hoặc chưa ra) trong N kỳ gần nhất.',
  },
]

export interface Prediction {
  numbers: number[]
  extra: number | null // số may mắn dự đoán (Lotto 5/35)
  detail: string[]
  usedDraws: number
  adjusted: boolean
}

// Đảm bảo bộ số không trùng nhau và nằm trong 1..max:
// nếu một số đã bị lấy thì tìm số trống gần nó nhất.
function uniqueClamp(nums: number[], max: number): number[] {
  const taken = new Set<number>()
  const out: number[] = []
  for (const raw of nums) {
    const n = Math.min(max, Math.max(1, Math.round(raw)))
    if (!taken.has(n)) {
      taken.add(n)
      out.push(n)
      continue
    }
    for (let off = 1; off <= max; off++) {
      const up = n + off
      const down = n - off
      if (up <= max && !taken.has(up)) {
        taken.add(up)
        out.push(up)
        break
      }
      if (down >= 1 && !taken.has(down)) {
        taken.add(down)
        out.push(down)
        break
      }
    }
  }
  return out
}

// Giá trị tại "vị trí" t (có thể lẻ) trên dàn số đã xếp tăng dần — nội suy tuyến tính.
// Dùng cho vé bao: k vị trí trải đều trên pickCount vị trí gốc; khi k = pickCount
// thì t rơi đúng vào từng vị trí nguyên, kết quả y hệt cách tính thường.
function valueAt(sorted: number[], t: number): number {
  const lo = Math.floor(t)
  const hi = Math.min(sorted.length - 1, Math.ceil(t))
  const frac = t - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

export function predict(
  game: Game,
  draws: Draw[],
  periods: number,
  method: PredictMethod,
  count: number = game.pickCount,
): Prediction {
  const k = Math.min(Math.max(count, game.pickCount), game.maxBao)
  const scanned = sortDrawsNewest(draws).slice(0, Math.max(1, periods))
  const mains = scanned.map((d) =>
    [...d.result.slice(0, game.mainCount)].sort((a, b) => a - b),
  )

  const raw: number[] = []
  const detail: string[] = []

  if (method === 'avg' || method === 'max-pos' || method === 'min-pos') {
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0 : (i * (game.pickCount - 1)) / (k - 1)
      const column = mains
        .filter((m) => m.length === game.pickCount)
        .map((m) => valueAt(m, t))
      if (!column.length) continue
      if (method === 'avg') {
        const avg = column.reduce((a, b) => a + b, 0) / column.length
        const v = Math.round(avg)
        raw.push(v)
        detail.push(`Vị trí ${i + 1}: trung bình ${avg.toFixed(1)} → ${pad(v)}`)
      } else if (method === 'max-pos') {
        const v = Math.round(Math.max(...column))
        raw.push(v)
        detail.push(`Vị trí ${i + 1}: lớn nhất là ${pad(v)}`)
      } else {
        const v = Math.round(Math.min(...column))
        raw.push(v)
        detail.push(`Vị trí ${i + 1}: nhỏ nhất là ${pad(v)}`)
      }
    }
  } else {
    const { stats } = computeStats(game, scanned, 0)
    const sorted = [...stats].sort((a, b) =>
      method === 'most-freq'
        ? b.count - a.count || a.number - b.number
        : a.count - b.count || a.number - b.number,
    )
    for (const s of sorted.slice(0, k)) {
      raw.push(s.number)
      detail.push(
        `${pad(s.number)}: ra ${s.count}/${scanned.length} kỳ (${s.percent.toFixed(1)}%)`,
      )
    }
  }

  const numbers = uniqueClamp(raw, game.maxNumber).sort((a, b) => a - b)
  const adjusted =
    numbers.join(',') !== [...raw].sort((a, b) => a - b).join(',')

  // Dự đoán số may mắn (Lotto 5/35) theo cùng phương thức
  let extra: number | null = null
  if (game.extraPick) {
    const max = game.extraPick.max
    const column = scanned
      .map((d) => d.result[game.mainCount])
      .filter((v): v is number => v !== undefined && v >= 1 && v <= max)
    if (column.length) {
      if (method === 'avg') {
        const avg = column.reduce((a, b) => a + b, 0) / column.length
        extra = Math.min(max, Math.max(1, Math.round(avg)))
        detail.push(
          `${game.extraPick.label}: trung bình ${avg.toFixed(1)} → ${pad(extra)}`,
        )
      } else if (method === 'max-pos') {
        extra = Math.max(...column)
        detail.push(`${game.extraPick.label}: lớn nhất là ${pad(extra)}`)
      } else if (method === 'min-pos') {
        extra = Math.min(...column)
        detail.push(`${game.extraPick.label}: nhỏ nhất là ${pad(extra)}`)
      } else {
        const freq = new Array<number>(max + 1).fill(0)
        for (const v of column) freq[v]++
        let best = 1
        for (let n = 1; n <= max; n++) {
          if (
            method === 'most-freq'
              ? freq[n] > freq[best]
              : freq[n] < freq[best]
          ) {
            best = n
          }
        }
        extra = best
        detail.push(
          `${game.extraPick.label}: ${pad(best)} ra ${freq[best]}/${column.length} kỳ`,
        )
      }
    }
  }

  return { numbers, extra, detail, usedDraws: scanned.length, adjusted }
}
