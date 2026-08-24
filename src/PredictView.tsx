import { useState } from 'react'
import {
  PREDICT_METHODS,
  predict,
  type PredictMethod,
  type Prediction,
} from './analysis.ts'
import { comb, formatPicks, formatVND, type Draw, type Game } from './games.ts'
import Ball from './Ball.tsx'
import CopyButton from './CopyButton.tsx'

interface Props {
  game: Game
  draws: Draw[]
  onUsePicks: (picks: number[], extra: number | null) => void
}

export default function PredictView({ game, draws, onUsePicks }: Props) {
  const [periods, setPeriods] = useState(20)
  const [method, setMethod] = useState<PredictMethod>('avg')
  const [count, setCount] = useState(game.pickCount)
  const [result, setResult] = useState<Prediction | null>(null)

  const methodInfo = PREDICT_METHODS.find((m) => m.value === method)
  const maxPeriods = draws.length

  const run = () => {
    const p = Math.min(maxPeriods, Math.max(1, periods))
    setPeriods(p)
    setResult(predict(game, draws, p, method, count))
  }

  return (
    <section className="card">
      <h2>🎯 Dự đoán số — {game.name}</h2>
      <p className="meta">
        Chọn công thức, app sẽ tính ra một bộ số từ dữ liệu lịch sử. Tính năng
        giải trí thôi nha — xổ số là ngẫu nhiên, kỳ trước không ảnh hưởng kỳ
        sau! 😄
      </p>

      <div className="predict-form">
        <label>
          Số kỳ gần nhất:{' '}
          <input
            type="number"
            min={1}
            max={maxPeriods}
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            className="input-number"
          />
          <span className="muted-small">
            {' '}
            / {maxPeriods.toLocaleString()} kỳ
          </span>
        </label>
        <label>
          Phương thức:{' '}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PredictMethod)}
          >
            {PREDICT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại vé:{' '}
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={game.pickCount}>
              Vé thường ({game.pickCount} số)
            </option>
            {Array.from(
              { length: game.maxBao - game.pickCount },
              (_, i) => game.pickCount + 1 + i,
            ).map((k) => (
              <option key={k} value={k}>
                Bao {k} ({comb(k, game.pickCount).toLocaleString()} tổ hợp ·{' '}
                {formatVND(comb(k, game.pickCount) * 10000)})
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary" onClick={run}>
          ✨ Dự đoán
        </button>
      </div>
      {methodInfo && <p className="hint">{methodInfo.desc}</p>}

      {result && (
        <div className="predict-result">
          <p className="predict-title">
            🍀 Bộ số may mắn của bạn
            {result.numbers.length > game.pickCount &&
              ` (vé bao ${result.numbers.length})`}{' '}
            — tính trên {result.usedDraws} kỳ gần nhất:
          </p>
          <div className="predict-balls">
            {result.numbers.map((n) => (
              <Ball key={n} number={n} highlight className="ball-lg" />
            ))}
            {result.extra !== null && (
              <>
                <span className="ball-sep">+</span>
                <Ball
                  number={result.extra}
                  highlight
                  color={game.bonusColor ?? 'gold'}
                  className="ball-lg"
                />
              </>
            )}
          </div>

          <ul className="predict-detail">
            {result.detail.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            {result.adjusted && (
              <li className="muted-small">
                (một vài số bị trùng nhau đã được dời sang số trống gần nhất)
              </li>
            )}
          </ul>

          <div className="predict-actions">
            <CopyButton
              text={formatPicks(result.numbers, result.extra)}
              label="Copy bộ số"
            />
            <button
              className="btn-secondary"
              onClick={() => onUsePicks(result.numbers, result.extra)}
            >
              🔍 Dò thử bộ số này trong lịch sử
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
