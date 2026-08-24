import { useMemo, useState } from 'react'
import { computeExtraStats, computeStats, type NumberStat } from './analysis.ts'
import { formatPicks, type Draw, type Game } from './games.ts'
import Ball from './Ball.tsx'
import CopyButton from './CopyButton.tsx'

const RANGES = [
  { value: 0, label: 'Tất cả các kỳ' },
  { value: 50, label: '50 kỳ gần nhất' },
  { value: 100, label: '100 kỳ gần nhất' },
  { value: 500, label: '500 kỳ gần nhất' },
  { value: 1000, label: '1000 kỳ gần nhất' },
]

function StatsTable({
  stats,
  totalDraws,
  order,
}: {
  stats: NumberStat[]
  totalDraws: number
  order: 'desc' | 'asc'
}) {
  const sorted = useMemo(
    () =>
      [...stats].sort((a, b) =>
        order === 'desc'
          ? b.count - a.count || a.number - b.number
          : a.count - b.count || a.number - b.number,
      ),
    [stats, order],
  )
  const maxCount = Math.max(1, ...stats.map((s) => s.count))

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Số</th>
            <th>Số lần ra</th>
            <th>Tỷ lệ</th>
            <th>Ra gần nhất</th>
            <th>Kỳ chưa ra</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.number}>
              <td className="td-rank">{i + 1}</td>
              <td>
                <Ball number={s.number} />
              </td>
              <td>
                <b>{s.count.toLocaleString()}</b>
                <span className="muted-small"> / {totalDraws.toLocaleString()} kỳ</span>
              </td>
              <td className="td-bar">
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{s.percent.toFixed(1)}%</span>
              </td>
              <td>{s.lastDate ?? '—'}</td>
              <td>
                {s.gap === null ? (
                  <span className="muted-small">chưa ra lần nào</span>
                ) : s.gap === 0 ? (
                  <span className="tag-fresh">vừa ra kỳ mới nhất</span>
                ) : (
                  `${s.gap} kỳ`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StatsView({
  game,
  draws,
}: {
  game: Game
  draws: Draw[]
}) {
  const [limit, setLimit] = useState(0)
  const [order, setOrder] = useState<'desc' | 'asc'>('desc')

  const main = useMemo(
    () => computeStats(game, draws, limit),
    [game, draws, limit],
  )
  const extra = useMemo(
    () => computeExtraStats(game, draws, limit),
    [game, draws, limit],
  )

  const hot = useMemo(
    () =>
      [...main.stats]
        .sort((a, b) => b.count - a.count || a.number - b.number)
        .slice(0, game.pickCount),
    [main, game],
  )
  const cold = useMemo(
    () =>
      [...main.stats]
        .sort((a, b) => a.count - b.count || a.number - b.number)
        .slice(0, game.pickCount),
    [main, game],
  )
  const overdue = useMemo(
    () =>
      [...main.stats]
        .sort(
          (a, b) =>
            (b.gap ?? main.totalDraws) - (a.gap ?? main.totalDraws) ||
            a.number - b.number,
        )
        .slice(0, game.pickCount),
    [main],
  )

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
          Sắp xếp:{' '}
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as 'desc' | 'asc')}
          >
            <option value="desc">Ra nhiều nhất trước</option>
            <option value="asc">Ra ít nhất trước</option>
          </select>
        </label>
      </div>
      <p className="meta">
        Thống kê trên {main.totalDraws.toLocaleString()} kỳ.
      </p>

      <h2 className="stats-section-title">
        🔴 Thống kê số chính (1–{game.maxNumber})
      </h2>

      <div className="summary-grid">
        <div className="summary-box summary-hot">
          <p className="summary-title">
            🔥 Ra nhiều nhất
            <CopyButton text={formatPicks(hot.map((s) => s.number))} />
          </p>
          <div className="summary-balls">
            {hot.map((s) => (
              <div key={s.number} className="summary-item">
                <Ball number={s.number} highlight />
                <span>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="summary-box summary-cold">
          <p className="summary-title">
            🧊 Ra ít nhất
            <CopyButton text={formatPicks(cold.map((s) => s.number))} />
          </p>
          <div className="summary-balls">
            {cold.map((s) => (
              <div key={s.number} className="summary-item">
                <Ball number={s.number} className="ball-cold" />
                <span>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="summary-box summary-overdue">
          <p className="summary-title">
            ⏳ Lâu chưa ra
            <CopyButton text={formatPicks(overdue.map((s) => s.number))} />
          </p>
          <div className="summary-balls">
            {overdue.map((s) => (
              <div key={s.number} className="summary-item">
                <Ball number={s.number} color="gold" />
                <span>{s.gap === null ? 'chưa ra' : `${s.gap} kỳ`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StatsTable stats={main.stats} totalDraws={main.totalDraws} order={order} />

      {extra && game.hasBonus && (
        <>
          <h2 className="stats-section-title section-gap">
            {game.bonusIcon} Thống kê số đặc biệt — {game.bonusLabel} (1–
            {game.extraPick?.max ?? game.maxNumber})
          </h2>
          <p className="meta">
            {game.extraPick
              ? `${game.bonusLabel} quay từ bộ số riêng 1–${game.extraPick.max}, mỗi kỳ 1 số.`
              : `${game.bonusLabel} là bóng quay thêm sau ${game.mainCount} số chính, từ cùng bộ 1–${game.maxNumber}, mỗi kỳ 1 số.`}
          </p>
          <StatsTable
            stats={extra.stats}
            totalDraws={extra.totalDraws}
            order={order}
          />
        </>
      )}
    </section>
  )
}
