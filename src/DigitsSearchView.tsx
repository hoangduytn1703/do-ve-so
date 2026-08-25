import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  DIGIT_TIER_NAMES,
  searchDigitDraws,
  type DigitDraw,
  type DigitGame,
  type DigitMatch,
  type DigitPlayMode,
} from './digits.ts'
import { formatVND, idNum } from './games.ts'

const SCAN_LIMITS = [
  { value: 0, label: 'Tất cả các kỳ' },
  { value: 100, label: '100 kỳ gần nhất' },
  { value: 500, label: '500 kỳ gần nhất' },
  { value: 1000, label: '1000 kỳ gần nhất' },
]

const PAGE_SIZE = 200
const MAX_FAVS = 10
const MAX_QUEUE = 10

// Một bộ số Max 3D: 2 số 3 chữ số + kiểu chơi
interface DigitSet {
  mode: DigitPlayMode
  picks: string[]
}

const setKey = (s: DigitSet) => `${s.mode}:${s.picks.join('+')}`

function loadFavs(gameId: string): DigitSet[] {
  try {
    const raw = localStorage.getItem(`vietlott:dfavs:${gameId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DigitSet[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => Array.isArray(s.picks) && s.picks.length > 0 && s.mode)
      .slice(0, MAX_FAVS)
  } catch {
    return []
  }
}

function persistFavs(gameId: string, favs: DigitSet[]): void {
  try {
    localStorage.setItem(`vietlott:dfavs:${gameId}`, JSON.stringify(favs))
  } catch {
    // localStorage bị chặn thì thôi
  }
}

// Chuẩn hoá input về đúng 3 chữ số, hoặc null nếu không hợp lệ
function normalizeNum(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  if (!digits.length || digits.length > 3) return null
  return digits.padStart(3, '0')
}

// Bộ số hiển thị dạng chip
function SetChips({ set, game }: { set: DigitSet; game: DigitGame }) {
  const modeInfo = game.modes.find((m) => m.value === set.mode)
  return (
    <span className="digit-set">
      {set.picks.map((n, i) => (
        <span key={i} className="digit-num digit-num-hit">
          {n}
        </span>
      ))}
      {game.modes.length > 1 && modeInfo && (
        <span className="set-bao">{modeInfo.label}</span>
      )}
    </span>
  )
}

interface DigitRun {
  mode: DigitPlayMode
  picks: string[]
  results: DigitMatch[]
}

// Bảng kết quả chi tiết của MỘT bộ số — memo để không render lại khi gõ phím
const DigitsResultsSection = memo(function DigitsResultsSection({
  game,
  run,
}: {
  game: DigitGame
  run: DigitRun
}) {
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'best' | 'time'>('best')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    setFilterLabel(null)
    setSortMode('best')
    setVisibleCount(PAGE_SIZE)
  }, [run])

  const tierStats = useMemo(() => {
    const counts = new Map<string, number>()
    let winners = 0
    for (const r of run.results) {
      if (r.tier) winners++
      for (const w of r.tierWins) {
        counts.set(w.tier.label, (counts.get(w.tier.label) ?? 0) + 1)
      }
    }
    return { counts, winners }
  }, [run])

  const filtered = useMemo(() => {
    let rows = run.results
    if (filterLabel) {
      rows = rows.filter((r) =>
        r.tierWins.some((w) => w.tier.label === filterLabel),
      )
    }
    if (sortMode === 'time') {
      rows = [...rows].sort((x, y) => idNum(y.id) - idNum(x.id))
    }
    return rows
  }, [run, filterLabel, sortMode])

  const range = useMemo(() => {
    if (!run.results.length) return null
    let oldest = run.results[0]
    let newest = run.results[0]
    for (const r of run.results) {
      if (idNum(r.id) < idNum(oldest.id)) oldest = r
      if (idNum(r.id) > idNum(newest.id)) newest = r
    }
    return { oldest, newest }
  }, [run])

  if (!range) return null

  const modeInfo = game.modes.find((m) => m.value === run.mode)

  return (
    <section className="card">
      <h2>
        Kết quả · {modeInfo?.label} · bộ số {run.picks.join(' + ')}
      </h2>
      <p className="meta">
        Đã dò {run.results.length.toLocaleString()} kỳ (kỳ {range.oldest.id}{' '}
        ngày {range.oldest.date} → kỳ {range.newest.id} ngày {range.newest.date}
        )
      </p>

      <div className="stats-row">
        {[...tierStats.counts.entries()].map(([label, count]) => (
          <button
            key={label}
            className={'stat' + (filterLabel === label ? ' stat-active' : '')}
            onClick={() => {
              setFilterLabel(filterLabel === label ? null : label)
              setVisibleCount(PAGE_SIZE)
            }}
            title={`Lọc các kỳ trúng ${label}`}
          >
            <b>{label}</b>
            <span>{count.toLocaleString()} kỳ</span>
          </button>
        ))}
        <div className="stat stat-plain stat-win">
          <b>🏆 Có giải</b>
          <span>{tierStats.winners.toLocaleString()} kỳ</span>
        </div>
      </div>

      <div className="sort-row">
        <span className="muted-small">Sắp xếp:</span>
        <button
          className={'sort-tab' + (sortMode === 'best' ? ' sort-tab-active' : '')}
          onClick={() => {
            setSortMode('best')
            setVisibleCount(PAGE_SIZE)
          }}
        >
          🏆 Gần trúng nhất
        </button>
        <button
          className={'sort-tab' + (sortMode === 'time' ? ' sort-tab-active' : '')}
          onClick={() => {
            setSortMode('time')
            setVisibleCount(PAGE_SIZE)
          }}
        >
          🕐 Theo thời gian (mới → cũ)
        </button>
      </div>

      <div className="table-wrap">
        <table className="digits-table">
          <thead>
            <tr>
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
                <td className="td-tiers">
                  {r.tierWins.length ? (
                    <div className="tier-chips">
                      {r.tierWins.map((w) => (
                        <span
                          key={w.tier.label}
                          className={
                            'tier-chip' +
                            (w.tier.rank <= 2 ? ' tier-chip-jackpot' : '')
                          }
                        >
                          {w.tier.label}
                          {w.count > 1 ? ` ×${w.count}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td-prize">
                  {r.totalPrize > 0 ? <b>{formatVND(r.totalPrize)}</b> : '—'}
                </td>
                <td>{r.id}</td>
                <td>{r.date}</td>
                <td className="td-digit-result">
                  {r.tiers.map((list, ti) => (
                    <span key={ti} className="digit-tier">
                      <span className="digit-tier-name">
                        {DIGIT_TIER_NAMES[ti].replace('Giải ', '')}:
                      </span>
                      {list.map((num, pi) => (
                        <span
                          key={`${ti}-${pi}`}
                          className={
                            'digit-num' +
                            (r.hitKeys.has(`${ti}:${pi}`)
                              ? ' digit-num-hit'
                              : '')
                          }
                        >
                          {num}
                        </span>
                      ))}
                    </span>
                  ))}
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
  game: DigitGame
  draws: DigitDraw[]
}

export default function DigitsSearchView({ game, draws }: Props) {
  const [mode, setMode] = useState<DigitPlayMode>(game.modes[0].value)
  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')
  const [scanLimit, setScanLimit] = useState(0)
  const [favs, setFavs] = useState<DigitSet[]>(() => loadFavs(game.id))
  const [favOpen, setFavOpen] = useState(false)
  const [queue, setQueue] = useState<DigitSet[]>([])
  const [searches, setSearches] = useState<DigitRun[] | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)

  const modeInfo = game.modes.find((m) => m.value === mode) ?? game.modes[0]

  // Bấm dò xong tự cuộn xuống phần kết quả
  useEffect(() => {
    if (searches) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searches])

  const a = normalizeNum(inputA)
  const b = normalizeNum(inputB)
  const picksReady = a !== null && b !== null

  const currentSet: DigitSet | null = picksReady
    ? { mode, picks: [a!, b!] }
    : null
  const currentKey = currentSet ? setKey(currentSet) : ''
  const favKeys = new Set(favs.map(setKey))
  const queueKeys = new Set(queue.map(setKey))

  const randomPick = () => {
    const rand = () => String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    setInputA(rand())
    setInputB(rand())
  }

  // ===== Bộ số yêu thích =====
  const saveFav = () => {
    if (!currentSet || favs.length >= MAX_FAVS || favKeys.has(currentKey))
      return
    const next = [...favs, currentSet]
    setFavs(next)
    persistFavs(game.id, next)
    setFavOpen(true)
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
  const addToQueue = (set: DigitSet) => {
    if (queue.length >= MAX_QUEUE || queueKeys.has(setKey(set))) return
    setQueue([...queue, { mode: set.mode, picks: [...set.picks] }])
  }

  const addAllFavs = () => {
    const next = [...queue]
    const keys = new Set(next.map(setKey))
    for (const f of favs) {
      if (next.length >= MAX_QUEUE) break
      const key = setKey(f)
      if (!keys.has(key)) {
        next.push({ mode: f.mode, picks: [...f.picks] })
        keys.add(key)
      }
    }
    setQueue(next)
  }

  const allFavsQueued =
    favs.length > 0 && favs.every((f) => queueKeys.has(setKey(f)))

  const canSearch = queue.length > 0

  const runSearch = () => {
    if (!queue.length) return
    const runs = queue.map((s) => ({
      mode: s.mode,
      picks: [...s.picks],
      results: searchDigitDraws(s.mode, s.picks, draws, { limit: scanLimit }),
    }))
    setSearches(runs)
    setActiveIdx(0)
  }

  // Tổng quan khi dò nhiều bộ
  const summary = useMemo(() => {
    if (!searches || searches.length < 2) return null
    return searches.map((run) => {
      const best = run.results[0]
      let winners = 0
      let latestWin: DigitMatch | null = null
      for (const r of run.results) {
        if (r.tier) {
          winners++
          if (!latestWin || idNum(r.id) > idNum(latestWin.id)) latestWin = r
        }
      }
      return { best, winners, latestWin }
    })
  }, [searches])

  const activeRun =
    searches && searches.length
      ? searches[Math.min(activeIdx, searches.length - 1)]
      : null

  return (
    <>
      <section className="card">
        <h2>Chọn kiểu chơi & bộ số</h2>

        <div className="mode-row">
          <label>
            🎫 Kiểu chơi:{' '}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as DigitPlayMode)}
            >
              {game.modes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <span className="hint">Chọn 2 số, mỗi số 3 chữ số (000–999)</span>
        </div>
        <p className="hint digit-desc">{modeInfo.desc}</p>

        <div className="digit-inputs">
          <input
            className="digit-input"
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="000"
            value={inputA}
            onChange={(e) => setInputA(e.target.value.replace(/\D/g, ''))}
          />
          <span className="ball-sep">+</span>
          <input
            className="digit-input"
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="000"
            value={inputB}
            onChange={(e) => setInputB(e.target.value.replace(/\D/g, ''))}
          />
          <button className="btn-secondary" onClick={randomPick}>
            🎲 Ngẫu nhiên
          </button>
        </div>

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
                  : 'Thêm bộ số đang nhập vào danh sách dò'
            }
            onClick={() => currentSet && addToQueue(currentSet)}
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
                  : 'Lưu bộ số đang nhập vào yêu thích'
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
            <span className="hint">Nhập đủ 2 số gồm 3 chữ số</span>
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
                <SetChips set={s} game={game} />
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
            ⭐ Bộ số yêu thích ({favs.length}/{MAX_FAVS})
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
              Nhập 2 số ở ngoài rồi bấm "💾 Lưu yêu thích" để lần sau khỏi nhập
              lại.
            </p>
          ) : (
            favs.map((f, i) => (
              <div key={setKey(f)} className="fav-card">
                <div className="fav-card-top">
                  <SetChips set={f} game={game} />
                </div>
                <div className="fav-card-actions">
                  <button
                    className="btn-mini"
                    title="Điền bộ số này vào ô nhập"
                    onClick={() => {
                      setMode(f.mode)
                      setInputA(f.picks[0] ?? '')
                      setInputB(f.picks[1] ?? '')
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
                      <SetChips
                        set={{ mode: run.mode, picks: run.picks }}
                        game={game}
                      />
                    </td>
                    <td>
                      {summary[i].best?.tier ? (
                        <span
                          className={
                            'tier-chip' +
                            (summary[i].best!.tier!.rank <= 2
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

      {activeRun && <DigitsResultsSection game={game} run={activeRun} />}
    </>
  )
}
