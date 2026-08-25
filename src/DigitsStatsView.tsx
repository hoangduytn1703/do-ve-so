import { useMemo, useState } from 'react'
import {
  computeDigitNumberStats,
  computeDigitPositionStats,
  idNumSort,
  type DigitDraw,
  type DigitGame,
} from './digits.ts'
import CopyButton from './CopyButton.tsx'

const RANGES = [
  { value: 0, label: 'Tất cả các kỳ' },
  { value: 100, label: '100 kỳ gần nhất' },
  { value: 500, label: '500 kỳ gần nhất' },
  { value: 1000, label: '1000 kỳ gần nhất' },
]

const POSITION_NAMES = ['Hàng trăm', 'Hàng chục', 'Hàng đơn vị']

export default function DigitsStatsView({
  game,
  draws,
}: {
  game: DigitGame
  draws: DigitDraw[]
}) {
  const [limit, setLimit] = useState(0)
  const [allTiers, setAllTiers] = useState(true)
  const [showCount, setShowCount] = useState(30)

  const scanned = useMemo(() => {
    const sorted = idNumSort(draws)
    return limit > 0 ? sorted.slice(0, limit) : sorted
  }, [draws, limit])

  const positionStats = useMemo(
    () => computeDigitPositionStats(scanned, { allTiers }),
    [scanned, allTiers],
  )

  const numberStats = useMemo(
    () => computeDigitNumberStats(scanned),
    [scanned],
  )

  const maxPos = Math.max(1, ...positionStats.flat())

  return (
    <section className="card">
      <h2>📊 Thống kê tần suất — {game.name}</h2>
      <div className="search-row">
        <label>
          Phạm vi:{' '}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tính theo:{' '}
          <select
            value={allTiers ? 'all' : 'db'}
            onChange={(e) => setAllTiers(e.target.value === 'all')}
          >
            <option value="all">Cả 20 số mỗi kỳ</option>
            <option value="db">Chỉ giải Đặc biệt</option>
          </select>
        </label>
      </div>
      <p className="meta">
        Thống kê trên {scanned.length.toLocaleString()} kỳ, mỗi kỳ quay 20 bộ
        ba số (Đặc biệt 2, Nhất 4, Nhì 6, Ba 8).
      </p>

      <h2 className="stats-section-title">🔢 Tần suất chữ số theo vị trí</h2>
      <div className="digit-pos-grid">
        {positionStats.map((digits, pos) => (
          <div key={pos} className="digit-pos-box">
            <p className="summary-title">{POSITION_NAMES[pos]}</p>
            {digits
              .map((count, digit) => ({ digit, count }))
              .sort((x, y) => y.count - x.count)
              .map(({ digit, count }) => (
                <div key={digit} className="digit-pos-row">
                  <b className="digit-pos-num">{digit}</b>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(count / maxPos) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">{count.toLocaleString()}</span>
                </div>
              ))}
          </div>
        ))}
      </div>

      <h2 className="stats-section-title section-gap">
        🔥 Bộ ba số ra nhiều nhất (tính cả 20 số mỗi kỳ)
      </h2>
      <p className="meta">
        Top {Math.min(showCount, numberStats.stats.length)} /{' '}
        {numberStats.stats.length.toLocaleString()} bộ số từng xuất hiện ·{' '}
        <CopyButton
          text={numberStats.stats
            .slice(0, 6)
            .map((s) => s.number)
            .join(' ')}
          label="Copy top 6"
        />
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Bộ số</th>
              <th>Số lần ra</th>
              <th>Ra gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {numberStats.stats.slice(0, showCount).map((s, i) => (
              <tr key={s.number}>
                <td className="td-rank">{i + 1}</td>
                <td>
                  <span className="digit-num digit-num-hit">{s.number}</span>
                </td>
                <td>
                  <b>{s.count.toLocaleString()}</b>
                </td>
                <td>{s.lastDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {numberStats.stats.length > showCount && (
        <div className="show-more">
          <button
            className="btn-secondary"
            onClick={() => setShowCount((c) => c + 30)}
          >
            Hiện thêm
          </button>
        </div>
      )}
    </section>
  )
}
