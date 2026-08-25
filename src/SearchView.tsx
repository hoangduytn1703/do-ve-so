import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  comb,
  formatPicks,
  formatVND,
  idNum,
  searchDraws,
  type Draw,
  type Game,
  type MatchResult,
} from './games.ts'
import Ball from './Ball.tsx'

const SCAN_LIMITS = [
  { value: 0, label: 'Tất cả các kỳ' },
  { value: 100, label: '100 kỳ gần nhất' },
  { value: 500, label: '500 kỳ gần nhất' },
  { value: 1000, label: '1000 kỳ gần nhất' },
]

const PAGE_SIZE = 200
const MAX_FAVS = 10
const MAX_QUEUE = 10

// Một bộ số: dàn số chính + các số may mắn (Lotto 5/35 có thể bao nhiều số may mắn)
interface QuerySet {
  picks: number[]
  extraPicks: number[]
}

const setKey = (s: QuerySet) =>
  s.picks.join(',') + '|' + s.extraPicks.join(',')

function loadFavs(gameId: string): QuerySet[] {
  try {
    const raw = localStorage.getItem(`vietlott:favs:${gameId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{
      picks?: number[]
      extraPicks?: number[]
      extraPick?: number | null // format cũ (1 số may mắn)
    }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => Array.isArray(s.picks) && s.picks.length > 0)
      .map((s) => ({
        picks: s.picks!,
        extraPicks: Array.isArray(s.extraPicks)
          ? s.extraPicks
          : s.extraPick != null
            ? [s.extraPick]
            : [],
      }))
      .slice(0, MAX_FAVS)
  } catch {
    return []
  }
}

function persistFavs(gameId: string, favs: QuerySet[]): void {
  try {
    localStorage.setItem(`vietlott:favs:${gameId}`, JSON.stringify(favs))
  } catch {
    // localStorage bị chặn thì thôi, chỉ mất tính năng lưu
  }
}

// Đọc dãy số từ chuỗi dán vào: chấp nhận cả có dấu cách ("6 17 23 24 32 42")
// lẫn viết liền ("061723243242" → tách từng cặp 2 chữ số).
function parseNumbers(text: string): number[] {
  const tokens = text.split(/[^0-9]+/).filter(Boolean)
  const numbers: number[] = []
  for (const token of tokens) {
    if (token.length <= 2) {
      numbers.push(parseInt(token, 10))
      continue
    }
    // Chuỗi liền: nếu lẻ ký tự thì số đầu là 1 chữ số, còn lại tách cặp
    let rest = token
    if (rest.length % 2 === 1) {
      numbers.push(parseInt(rest[0], 10))
      rest = rest.slice(1)
    }
    for (let i = 0; i < rest.length; i += 2) {
      numbers.push(parseInt(rest.slice(i, i + 2), 10))
    }
  }
  return numbers
}

interface SearchRun {
  results: MatchResult[]
  picks: number[]
  extraPicks: number[]
}

// Kiểu vé: thường, bao số chính, hoặc bao số may mắn (Lotto 5/35)
type TicketMode =
  | { kind: 'basic'; count: number }
  | { kind: 'bao-main'; count: number }
  | { kind: 'bao-lucky'; count: number }

// Suy ra kiểu vé từ một bộ số có sẵn (dán chuỗi / dùng lại bộ yêu thích)
function inferMode(
  picks: number[],
  extraPicks: number[],
  game: Game,
): TicketMode {
  if (game.kind === 'keno') {
    // Keno: bậc = số lượng số đã chọn (1-10)
    return {
      kind: 'basic',
      count: Math.min(game.maxBao, Math.max(1, picks.length || game.pickCount)),
    }
  }
  if (extraPicks.length > 1)
    return { kind: 'bao-lucky', count: extraPicks.length }
  if (picks.length > game.pickCount)
    return { kind: 'bao-main', count: picks.length }
  return { kind: 'basic', count: game.pickCount }
}

// Bộ số hiển thị dạng bóng tròn nhỏ (dùng ở yêu thích / danh sách dò / tổng quan)
function SetBalls({ set, game }: { set: QuerySet; game: Game }) {
  return (
    <span className="set-balls">
      {set.picks.map((n) => (
        <Ball key={n} number={n} highlight className="ball-sm" />
      ))}
      {set.extraPicks.length > 0 && <span className="ball-sep">+</span>}
      {set.extraPicks.map((n) => (
        <Ball
          key={`e${n}`}
          number={n}
          highlight
          color={game.bonusColor ?? 'gold'}
          className="ball-sm"
        />
      ))}
    </span>
  )
}

// Nhãn kiểu bao/bậc của một bộ số (nếu có)
function baoLabel(set: QuerySet, game: Game): string | null {
  if (game.kind === 'keno') return `bậc ${set.picks.length}`
  if (set.picks.length > game.pickCount) return `bao ${set.picks.length}`
  if (set.extraPicks.length > 1) return `bao ${set.extraPicks.length} ${game.extraPick?.label.toLowerCase() ?? 'số phụ'}`
  return null
}

// Memo hoá: bảng kết quả (có thể vài trăm dòng) chỉ render lại khi bấm Dò,
// không render theo từng lần chọn số / gõ phím ở phần trên.
const ResultsSection = memo(function ResultsSection({
  game,
  search,
}: {
  game: Game
  search: SearchRun
}) {
  const [minMatched, setMinMatched] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sortMode, setSortMode] = useState<'best' | 'time'>('best')

  useEffect(() => {
    setMinMatched(0)
    setVisibleCount(PAGE_SIZE)
  }, [search])

  const stats = useMemo(() => {
    if (!search.results.length) return null
    const byMatched: Record<number, number> = {}
    let bonusHits = 0
    let winners = 0
    for (const r of search.results) {
      byMatched[r.matched] = (byMatched[r.matched] || 0) + 1
      if (r.bonusMatched) bonusHits++
      if (r.tier) winners++
    }
    const oldest = search.results.reduce((a, b) =>
      idNum(a.id) < idNum(b.id) ? a : b,
    )
    const newest = search.results.reduce((a, b) =>
      idNum(a.id) > idNum(b.id) ? a : b,
    )
    return { byMatched, bonusHits, winners, oldest, newest }
  }, [search])

  const filtered = useMemo(() => {
    const rows = search.results.filter((r) => r.matched >= minMatched)
    if (sortMode === 'time') {
      // Theo thời gian như trang Vietlott: kỳ mới nhất trước
      return [...rows].sort((a, b) => idNum(b.id) - idNum(a.id))
    }
    return rows // search.results đã sắp gần trúng nhất trước
  }, [search, minMatched, sortMode])

  if (!stats) return null

  const bao = baoLabel(search, game)

  return (
    <section className="card">
      <h2>
        Kết quả · {bao ? `${bao} · ` : ''}bộ số{' '}
        {formatPicks(search.picks, search.extraPicks)}
      </h2>
      <p className="meta">
        Đã dò {search.results.length.toLocaleString()} kỳ (kỳ {stats.oldest.id}{' '}
        ngày {stats.oldest.date} → kỳ {stats.newest.id} ngày {stats.newest.date}
        )
      </p>

      <div className="stats-row">
        {Object.keys(stats.byMatched)
          .map(Number)
          .sort((a, b) => b - a)
          .map((m) => (
            <button
              key={m}
              className={
                'stat' + (minMatched === m && m > 0 ? ' stat-active' : '')
              }
              onClick={() => {
                setMinMatched(minMatched === m ? 0 : m)
                setVisibleCount(PAGE_SIZE)
              }}
              title={m > 0 ? `Lọc các kỳ trùng ≥ ${m} số` : 'Bỏ lọc'}
            >
              <b>{m}</b> số trùng
              <span>{stats.byMatched[m].toLocaleString()} kỳ</span>
            </button>
          ))}
        {game.hasBonus && (
          <div className="stat stat-plain">
            <b>
              {game.bonusIcon} {game.bonusLabel}
            </b>
            <span>{stats.bonusHits.toLocaleString()} kỳ trúng</span>
          </div>
        )}
        <div className="stat stat-plain stat-win">
          <b>🏆 Có giải</b>
          <span>{stats.winners.toLocaleString()} kỳ</span>
        </div>
      </div>

      {minMatched > 0 && (
        <p className="meta">
          Đang lọc: chỉ hiện kỳ trùng ≥ {minMatched} số (
          {filtered.length.toLocaleString()} kỳ) ·{' '}
          <button className="btn-link" onClick={() => setMinMatched(0)}>
            Bỏ lọc
          </button>
        </p>
      )}

      <div className="sort-row">
        <span className="muted-small">Sắp xếp:</span>
        <button
          className={
            'sort-tab' + (sortMode === 'best' ? ' sort-tab-active' : '')
          }
          onClick={() => {
            setSortMode('best')
            setVisibleCount(PAGE_SIZE)
          }}
        >
          🏆 Gần trúng nhất
        </button>
        <button
          className={
            'sort-tab' + (sortMode === 'time' ? ' sort-tab-active' : '')
          }
          onClick={() => {
            setSortMode('time')
            setVisibleCount(PAGE_SIZE)
          }}
        >
          🕐 Theo thời gian (mới → cũ)
        </button>
      </div>

      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th>Trùng</th>
              <th>Giải</th>
              <th>Tiền thưởng</th>
              <th>Kỳ</th>
              <th>Ngày</th>
              <th>Kết quả quay thưởng</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, visibleCount).map((r) => (
              <tr key={r.id} className={r.tier ? 'row-win' : ''}>
                <td className="td-matched">
                  <b>{r.matched}</b>
                  {r.bonusMatched && (
                    <span className="bonus-tag">+{game.bonusIcon}</span>
                  )}
                </td>
                <td className="td-tiers">
                  {r.tierWins.length ? (
                    <div className="tier-chips">
                      {r.tierWins.map((w) => (
                        <span
                          key={w.tier.rank}
                          className={
                            'tier-chip' +
                            (w.tier.minPrize ? ' tier-chip-jackpot' : '')
                          }
                        >
                          {w.tier.label}
                          {w.count > 1 ? ` ×${w.count.toLocaleString()}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td-prize">
                  {r.totalPrize > 0 ? (
                    <b>
                      {r.totalIsMin ? '≥ ' : ''}
                      {formatVND(r.totalPrize)}
                    </b>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{r.id}</td>
                <td>{r.date}</td>
                <td className="td-balls">
                  {r.main.map((n) => (
                    <Ball
                      key={n}
                      number={n}
                      highlight={r.matchedNumbers.includes(n)}
                    />
                  ))}
                  {r.bonus !== null && (
                    <>
                      <span className="ball-sep">|</span>
                      <Ball
                        number={r.bonus}
                        highlight={r.bonusMatched}
                        color={game.bonusColor ?? 'gold'}
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div className="show-more">
          <button
            className="btn-secondary"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Hiện thêm ({(filtered.length - visibleCount).toLocaleString()} kỳ
            còn lại)
          </button>
        </div>
      )}
    </section>
  )
})

interface Props {
  game: Game
  draws: Draw[]
  picks: number[]
  setPicks: (picks: number[]) => void
  extraPicks: number[]
  setExtraPicks: (n: number[]) => void
}

export default function SearchView({
  game,
  draws,
  picks,
  setPicks,
  extraPicks,
  setExtraPicks,
}: Props) {
  const [pasteText, setPasteText] = useState('')
  const [scanLimit, setScanLimit] = useState(0)
  const [favs, setFavs] = useState<QuerySet[]>(() => loadFavs(game.id))
  const [favOpen, setFavOpen] = useState(false)

  // Đổi loại xổ số → nạp lại đúng danh sách yêu thích của loại đó, đóng ngăn kéo
  useEffect(() => {
    setFavs(loadFavs(game.id))
    setFavOpen(false)
  }, [game.id])
  const [queue, setQueue] = useState<QuerySet[]>([])
  const [searches, setSearches] = useState<SearchRun[] | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Bấm dò xong tự cuộn xuống phần kết quả
  useEffect(() => {
    if (searches) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searches])

  // Kiểu vé đang chơi: state riêng, quyết định cần chọn bao nhiêu số thường /
  // số may mắn. Luật Vietlott: bao số thường và bao số may mắn không dùng chung.
  const [ticketMode, setTicketModeState] = useState<TicketMode>({
    kind: 'basic',
    count: game.pickCount,
  })

  // Đổi kiểu vé thì cắt bớt số đang chọn cho vừa, giữ lại phần hợp lệ
  const setTicketMode = (mode: TicketMode) => {
    setTicketModeState(mode)
    if (mode.kind === 'bao-lucky') {
      setPicks(picks.slice(0, game.pickCount))
      setExtraPicks(extraPicks.slice(0, mode.count))
    } else {
      setPicks(picks.slice(0, mode.kind === 'bao-main' ? mode.count : game.pickCount))
      setExtraPicks(extraPicks.slice(0, 1))
    }
  }

  // basic của keno = bậc (1-10 số); basic của lotto luôn = pickCount
  const needMain =
    ticketMode.kind === 'bao-lucky' ? game.pickCount : ticketMode.count
  const needLucky = ticketMode.kind === 'bao-lucky' ? ticketMode.count : 1

  const togglePick = (n: number) => {
    if (picks.includes(n)) {
      setPicks(picks.filter((x) => x !== n))
    } else if (picks.length < needMain) {
      setPicks([...picks, n].sort((a, b) => a - b))
    }
  }

  const toggleLucky = (n: number) => {
    if (extraPicks.includes(n)) {
      setExtraPicks(extraPicks.filter((x) => x !== n))
    } else if (extraPicks.length < needLucky) {
      setExtraPicks([...extraPicks, n].sort((a, b) => a - b))
    }
  }

  // Bốc ngẫu nhiên `count` số khác nhau trong 1..max
  const drawRandom = (max: number, count: number) => {
    const pool = Array.from({ length: max }, (_, i) => i + 1)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count).sort((a, b) => a - b)
  }

  // Ngẫu nhiên theo đúng kiểu vé đang chọn (kể cả vé bao)
  const randomPick = () => {
    setPicks(drawRandom(game.maxNumber, needMain))
    if (game.extraPick) {
      setExtraPicks(drawRandom(game.extraPick.max, needLucky))
    }
  }

  const clearPicks = () => {
    setPicks([])
    setExtraPicks([])
  }

  const applyPaste = () => {
    // "06 17 23 24 32 + 09" (hoặc "+ 03 07 09" khi bao số may mắn)
    let mainText = pasteText
    let luckyText = ''
    if (game.extraPick && pasteText.includes('+')) {
      const idx = pasteText.lastIndexOf('+')
      mainText = pasteText.slice(0, idx)
      luckyText = pasteText.slice(idx + 1)
    }

    let all = parseNumbers(mainText)
    let luckies: number[] = []
    if (game.extraPick) {
      const maxL = game.extraPick.max
      if (luckyText) {
        luckies = [
          ...new Set(parseNumbers(luckyText).filter((n) => n >= 1 && n <= maxL)),
        ].sort((a, b) => a - b)
      } else if (all.length === game.pickCount + 1) {
        // Dán đúng thừa 1 số cuối hợp lệ thì hiểu là số may mắn
        const last = all[all.length - 1]
        if (last >= 1 && last <= maxL) {
          luckies = [last]
          all = all.slice(0, -1)
        }
      }
    }

    let main = [...new Set(all.filter((n) => n >= 1 && n <= game.maxNumber))]
      .slice(0, game.maxBao)
      .sort((a, b) => a - b)
    // Không cho bao cả hai phía cùng lúc: nhiều số may mắn → cắt số thường về đúng 5
    if (luckies.length > 1) main = main.slice(0, game.pickCount)
    if (main.length > game.pickCount) luckies = luckies.slice(0, 1)

    // Dán số nào thì chuyển kiểu vé theo đúng số lượng vừa dán
    setPicks(main)
    if (luckies.length) setExtraPicks(luckies)
    setTicketModeState(inferMode(main, luckies, game))
    setPasteText('')
  }

  // Các kiểu vé khả dụng cho game này
  const ticketModes: TicketMode[] =
    game.kind === 'keno'
      ? // Keno: bậc 1-10, mỗi bậc một bảng thưởng riêng
        Array.from(
          { length: game.maxBao },
          (_, i) => ({ kind: 'basic', count: i + 1 }) as const,
        )
      : [
          { kind: 'basic', count: game.pickCount },
          ...Array.from(
            { length: game.maxBao - game.pickCount },
            (_, i) =>
              ({ kind: 'bao-main', count: game.pickCount + 1 + i }) as const,
          ),
          ...(game.extraPick
            ? Array.from(
                { length: game.extraPick.max - 1 },
                (_, i) => ({ kind: 'bao-lucky', count: i + 2 }) as const,
              )
            : []),
        ]

  const modeLabel = (m: TicketMode) =>
    m.kind === 'basic'
      ? game.kind === 'keno'
        ? `Bậc ${m.count} (chọn ${m.count} số)`
        : `Vé thường (${m.count} số)`
      : m.kind === 'bao-main'
        ? `Bao ${m.count}`
        : `Bao ${m.count} ${game.extraPick?.label.toLowerCase()}`

  const modeKey = (m: TicketMode) => `${m.kind}:${m.count}`

  // Đủ số theo đúng kiểu vé đang chọn thì mới thêm được vào danh sách dò
  const picksReady =
    picks.length === needMain &&
    (!game.extraPick || extraPicks.length === needLucky)
  const comboCount =
    comb(picks.length, game.pickCount) * Math.max(1, extraPicks.length)

  const currentSet: QuerySet = { picks, extraPicks }
  const currentKey = setKey(currentSet)
  const favKeys = new Set(favs.map(setKey))
  const queueKeys = new Set(queue.map(setKey))

  // ===== Bộ số yêu thích (localStorage, tối đa 10 mỗi loại) =====
  const saveFav = () => {
    if (!picksReady || favs.length >= MAX_FAVS || favKeys.has(currentKey))
      return
    const next = [...favs, { picks: [...picks], extraPicks: [...extraPicks] }]
    setFavs(next)
    persistFavs(game.id, next)
    setFavOpen(true) // mở ngăn kéo để thấy ngay bộ vừa lưu
  }

  const removeFav = (index: number) => {
    const next = favs.filter((_, i) => i !== index)
    setFavs(next)
    persistFavs(game.id, next)
  }

  const clearFavs = () => {
    setFavs([])
    persistFavs(game.id, [])
  }

  // ===== Danh sách dò nhiều bộ (tối đa 10) =====
  const addToQueue = (set: QuerySet) => {
    if (queue.length >= MAX_QUEUE || queueKeys.has(setKey(set))) return
    setQueue([
      ...queue,
      { picks: [...set.picks], extraPicks: [...set.extraPicks] },
    ])
  }

  // Thêm tất cả bộ yêu thích vào danh sách dò
  const addAllFavs = () => {
    const next = [...queue]
    const keys = new Set(next.map(setKey))
    for (const f of favs) {
      if (next.length >= MAX_QUEUE) break
      const key = setKey(f)
      if (!keys.has(key)) {
        next.push({ picks: [...f.picks], extraPicks: [...f.extraPicks] })
        keys.add(key)
      }
    }
    setQueue(next)
  }

  const allFavsQueued =
    favs.length > 0 && favs.every((f) => queueKeys.has(setKey(f)))

  const runSearch = () => {
    if (!queue.length) return
    const runs = queue.map((s) => ({
      picks: [...s.picks],
      extraPicks: [...s.extraPicks],
      results: searchDraws(game, s.picks, s.extraPicks, draws, {
        limit: scanLimit,
      }),
    }))
    setSearches(runs)
    setActiveIdx(0)
  }

  // Chỉ dò từ danh sách: phải thêm bộ số vào danh sách trước
  const canSearch = queue.length > 0

  // Tổng quan khi dò nhiều bộ
  const summary = useMemo(() => {
    if (!searches || searches.length < 2) return null
    return searches.map((run) => {
      const best = run.results[0] // đã sort giải cao nhất lên đầu
      let winners = 0
      let latestWin: MatchResult | null = null
      for (const r of run.results) {
        if (r.tier) {
          winners++
          if (!latestWin || idNum(r.id) > idNum(latestWin.id)) {
            latestWin = r
          }
        }
      }
      return { best, winners, latestWin }
    })
  }, [searches])

  const activeSearch =
    searches && searches.length
      ? searches[Math.min(activeIdx, searches.length - 1)]
      : null

  return (
    <>
      <section className="card">
        <h2>Chọn kiểu vé & bộ số</h2>

        <div className="mode-row">
          <label>
            🎫 Kiểu vé:{' '}
            <select
              value={modeKey(ticketMode)}
              onChange={(e) => {
                const [kind, count] = e.target.value.split(':')
                setTicketMode({
                  kind: kind as TicketMode['kind'],
                  count: Number(count),
                } as TicketMode)
              }}
            >
              {ticketModes.map((m) => (
                <option key={modeKey(m)} value={modeKey(m)}>
                  {modeLabel(m)}
                  {m.kind !== 'basic' &&
                    ` — ${(m.kind === 'bao-main'
                      ? comb(m.count, game.pickCount)
                      : m.count
                    ).toLocaleString()} tổ hợp`}
                </option>
              ))}
            </select>
          </label>
          <span className="hint">
            Cần chọn {needMain} số (1–{game.maxNumber})
            {game.extraPick &&
              ` + ${needLucky} ${game.extraPick.label.toLowerCase()} (1–${game.extraPick.max})`}
          </span>
        </div>

        <div className="picked-row">
          {Array.from(
            { length: Math.max(needMain, picks.length) },
            (_, i) => (
              <span
                key={i}
                className={'ball ball-slot' + (picks[i] ? ' ball-picked' : '')}
              >
                {picks[i] ? String(picks[i]).padStart(2, '0') : '?'}
              </span>
            ),
          )}
          {game.extraPick && (
            <>
              <span className="ball-sep">+</span>
              {Array.from(
                { length: Math.max(needLucky, extraPicks.length) },
                (_, i) => (
                  <span
                    key={i}
                    className={
                      'ball ball-slot ball-slot-extra' +
                      (extraPicks[i] ? ' ball-picked-extra' : '')
                    }
                  >
                    {extraPicks[i]
                      ? String(extraPicks[i]).padStart(2, '0')
                      : '?'}
                  </span>
                ),
              )}
            </>
          )}
          <div className="pick-actions">
            <button className="btn-secondary" onClick={randomPick}>
              🎲 Ngẫu nhiên
            </button>
            <button
              className="btn-secondary"
              onClick={clearPicks}
              disabled={!picks.length && !extraPicks.length}
            >
              Xoá
            </button>
          </div>
        </div>

        {ticketMode.kind !== 'basic' && picksReady && (
          <p className="bao-badge">
            🎫 {modeLabel(ticketMode)}: {comboCount.toLocaleString()} tổ hợp ·
            giá vé {formatVND(comboCount * 10000)} · tiền thưởng các tổ hợp
            trúng được cộng dồn
          </p>
        )}

        <div className="number-grid">
          {Array.from({ length: game.maxNumber }, (_, i) => i + 1).map((n) => {
            const selected = picks.includes(n)
            const full = picks.length >= needMain && !selected
            return (
              <button
                key={n}
                className={'num' + (selected ? ' num-selected' : '')}
                disabled={full}
                title={
                  full
                    ? `${modeLabel(ticketMode)} chỉ chọn ${needMain} số — bỏ bớt số khác hoặc đổi kiểu vé`
                    : undefined
                }
                onClick={() => togglePick(n)}
              >
                {String(n).padStart(2, '0')}
              </button>
            )
          })}
        </div>

        {game.extraPick && (
          <div className="extra-pick">
            <p className="extra-label">
              {game.bonusIcon} {game.extraPick.label} — chọn {needLucky} số
              (1–{game.extraPick.max}):
            </p>
            <div className="number-grid number-grid-extra">
              {Array.from({ length: game.extraPick.max }, (_, i) => i + 1).map(
                (n) => {
                  const selected = extraPicks.includes(n)
                  const full = extraPicks.length >= needLucky && !selected
                  return (
                    <button
                      key={n}
                      className={
                        'num num-extra' + (selected ? ' num-selected-extra' : '')
                      }
                      disabled={full}
                      title={
                        full
                          ? `${modeLabel(ticketMode)} chỉ chọn ${needLucky} ${game.extraPick?.label.toLowerCase()} — đổi kiểu vé nếu muốn bao`
                          : undefined
                      }
                      onClick={() => toggleLucky(n)}
                    >
                      {String(n).padStart(2, '0')}
                    </button>
                  )
                },
              )}
            </div>
          </div>
        )}

        <div className="paste-row">
          <input
            type="text"
            placeholder={
              game.extraPick
                ? 'Dán nhanh: "06 17 23 24 32 + 09" (bao số may mắn: "+ 03 07 09")'
                : 'Dán nhanh: "6 17 23 24 32 42" hoặc "061723243242"'
            }
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyPaste()}
          />
          <button className="btn-secondary" onClick={applyPaste}>
            Áp dụng
          </button>
        </div>

        {/* Cụm hành động chính, ngay dưới ô dán nhanh */}
        <div className="action-row">
          <button
            className="btn-add"
            disabled={
              !picksReady ||
              queue.length >= MAX_QUEUE ||
              queueKeys.has(currentKey)
            }
            title={
              queue.length >= MAX_QUEUE
                ? `Tối đa ${MAX_QUEUE} bộ số mỗi lần dò`
                : queueKeys.has(currentKey)
                  ? 'Bộ số này đã có trong danh sách'
                  : 'Thêm bộ số đang chọn vào danh sách dò'
            }
            onClick={() => addToQueue(currentSet)}
          >
            ➕ Thêm vào danh sách dò
          </button>
          <button
            className="btn-primary"
            disabled={!canSearch}
            title={
              canSearch
                ? undefined
                : 'Thêm ít nhất 1 bộ số vào danh sách dò trước'
            }
            onClick={runSearch}
          >
            🔍 Dò {queue.length > 0 ? `${queue.length} bộ số` : 'số'}
          </button>
          <button
            className="btn-secondary"
            disabled={
              !picksReady || favs.length >= MAX_FAVS || favKeys.has(currentKey)
            }
            title={
              favs.length >= MAX_FAVS
                ? `Đã đủ ${MAX_FAVS} bộ yêu thích`
                : favKeys.has(currentKey)
                  ? 'Bộ số này đã lưu rồi'
                  : 'Lưu bộ số đang chọn vào yêu thích'
            }
            onClick={saveFav}
          >
            💾 Lưu yêu thích
          </button>
          <label className="scan-label">
            Phạm vi:{' '}
            <select
              value={scanLimit}
              onChange={(e) => setScanLimit(Number(e.target.value))}
            >
              {SCAN_LIMITS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {!picksReady ? (
            <span className="hint">
              {picks.length < needMain
                ? `Chọn thêm ${needMain - picks.length} số nữa`
                : game.extraPick && extraPicks.length < needLucky
                  ? `Chọn thêm ${needLucky - extraPicks.length} ${game.extraPick.label.toLowerCase()} nữa`
                  : 'Bỏ bớt số cho đúng kiểu vé'}
            </span>
          ) : (
            queue.length === 0 && (
              <span className="hint">
                Bấm "➕ Thêm vào danh sách dò" để dò bộ số này
              </span>
            )
          )}
        </div>

        {/* Danh sách dò nhiều bộ */}
        {queue.length > 0 && (
          <div className="sets-panel sets-panel-queue">
            <div className="sets-header">
              <b>
                🎯 Danh sách dò ({queue.length}/{MAX_QUEUE})
              </b>
              <button className="btn-link" onClick={() => setQueue([])}>
                Xoá hết
              </button>
            </div>
            {queue.map((s, i) => (
              <div key={setKey(s)} className="set-row">
                <span className="set-index">{i + 1}.</span>
                <SetBalls set={s} game={game} />
                {baoLabel(s, game) && (
                  <span className="set-bao">{baoLabel(s, game)}</span>
                )}
                <div className="set-actions">
                  <button
                    className="btn-mini btn-mini-danger"
                    title="Bỏ khỏi danh sách"
                    onClick={() =>
                      setQueue(queue.filter((_, idx) => idx !== i))
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* Nút mở & ngăn kéo bộ số yêu thích */}
      <button
        className="fav-fab"
        onClick={() => setFavOpen(true)}
        title="Bộ số yêu thích"
      >
        ⭐
        {favs.length > 0 && <span className="fav-count">{favs.length}</span>}
      </button>

      {favOpen && (
        <div className="drawer-backdrop" onClick={() => setFavOpen(false)} />
      )}

      <aside className={'fav-drawer' + (favOpen ? ' fav-drawer-open' : '')}>
        <div className="drawer-head">
          <b>
            ⭐ Yêu thích · {game.name} ({favs.length}/{MAX_FAVS})
          </b>
          <button
            className="btn-mini"
            onClick={() => setFavOpen(false)}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {favs.length > 0 && (
          <div className="drawer-actions">
            <button
              className="btn-add btn-add-sm"
              disabled={allFavsQueued || queue.length >= MAX_QUEUE}
              title={
                allFavsQueued
                  ? 'Tất cả đã có trong danh sách dò'
                  : queue.length >= MAX_QUEUE
                    ? `Danh sách dò đã đủ ${MAX_QUEUE} bộ`
                    : 'Thêm tất cả bộ yêu thích vào danh sách dò'
              }
              onClick={addAllFavs}
            >
              🎯 Dò hết
            </button>
            <button className="btn-link" onClick={clearFavs}>
              Xoá hết
            </button>
          </div>
        )}

        <div className="drawer-body">
          {favs.length === 0 ? (
            <p className="muted-small drawer-empty">
              Chưa có bộ số nào.
              <br />
              <br />
              Chọn số ở ngoài rồi bấm "💾 Lưu yêu thích" để lần sau khỏi nhập
              lại.
            </p>
          ) : (
            favs.map((f, i) => (
              <div key={setKey(f)} className="fav-card">
                <div className="fav-card-top">
                  <SetBalls set={f} game={game} />
                  {baoLabel(f, game) && (
                    <span className="set-bao">{baoLabel(f, game)}</span>
                  )}
                </div>
                <div className="fav-card-actions">
                  <button
                    className="btn-mini"
                    title="Điền bộ số này vào ô chọn"
                    onClick={() => {
                      setPicks([...f.picks])
                      setExtraPicks([...f.extraPicks])
                      setTicketModeState(inferMode(f.picks, f.extraPicks, game))
                    }}
                  >
                    Dùng
                  </button>
                  <button
                    className="btn-mini btn-mini-add"
                    disabled={
                      queue.length >= MAX_QUEUE || queueKeys.has(setKey(f))
                    }
                    title={
                      queueKeys.has(setKey(f))
                        ? 'Đã có trong danh sách dò'
                        : 'Thêm vào danh sách dò'
                    }
                    onClick={() => addToQueue(f)}
                  >
                    ➕ Dò
                  </button>
                  <button
                    className="btn-mini btn-mini-danger"
                    title="Xoá bộ số này"
                    onClick={() => removeFav(i)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div ref={resultsRef} />

      {/* Tổng quan khi dò nhiều bộ số */}
      {searches && summary && (
        <section className="card">
          <h2>Tổng quan {searches.length} bộ số</h2>
          <p className="meta">Bấm vào từng dòng để xem chi tiết bên dưới.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bộ số</th>
                  <th>Giải cao nhất từng trúng</th>
                  <th>Số kỳ có giải</th>
                  <th>Lần trúng gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {searches.map((run, i) => (
                  <tr
                    key={setKey(run)}
                    className={
                      'row-click' + (i === activeIdx ? ' row-active' : '')
                    }
                    onClick={() => setActiveIdx(i)}
                  >
                    <td className="td-rank">{i + 1}</td>
                    <td>
                      <SetBalls
                        set={{ picks: run.picks, extraPicks: run.extraPicks }}
                        game={game}
                      />
                      {baoLabel(run, game) && (
                        <span className="set-bao">{baoLabel(run, game)}</span>
                      )}
                    </td>
                    <td>
                      {summary[i].best?.tier ? (
                        <span
                          className={
                            'tier-chip' +
                            (summary[i].best!.tier!.minPrize
                              ? ' tier-chip-jackpot'
                              : '')
                          }
                        >
                          {summary[i].best!.tier!.label}
                        </span>
                      ) : (
                        <span className="muted-small">chưa từng có giải</span>
                      )}
                    </td>
                    <td>
                      <b>{summary[i].winners.toLocaleString()}</b>
                      <span className="muted-small">
                        {' '}
                        / {run.results.length.toLocaleString()} kỳ
                      </span>
                    </td>
                    <td>
                      {summary[i].latestWin
                        ? `${summary[i].latestWin!.date} (kỳ ${summary[i].latestWin!.id})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSearch && <ResultsSection game={game} search={activeSearch} />}
    </>
  )
}
