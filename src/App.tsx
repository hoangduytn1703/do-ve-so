import { useEffect, useState } from 'react'
import { GAMES, getGame, idNum, loadDraws, type Draw } from './games.ts'
import {
  DIGIT_GAMES,
  getDigitGame,
  loadDigitDraws,
  type DigitDraw,
} from './digits.ts'
import SearchView from './SearchView.tsx'
import StatsView from './StatsView.tsx'
import PredictView from './PredictView.tsx'
import DigitsSearchView from './DigitsSearchView.tsx'
import DigitsStatsView from './DigitsStatsView.tsx'
import GoTop from './GoTop.tsx'
import './App.css'

type View = 'search' | 'stats' | 'predict'

const VIEWS: { id: View; label: string }[] = [
  { id: 'search', label: '🔍 Dò số' },
  { id: 'stats', label: '📊 Thống kê' },
  { id: 'predict', label: '🎯 Dự đoán' },
]

const DISCLAIMER_KEY = 'vietlott:disclaimer-dismissed'

export default function App() {
  const [gameId, setGameId] = useState('power645')
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return localStorage.getItem(DISCLAIMER_KEY) !== '1'
    } catch {
      return true
    }
  })

  const dismissDisclaimer = () => {
    setShowDisclaimer(false)
    try {
      localStorage.setItem(DISCLAIMER_KEY, '1')
    } catch {
      // không lưu được thì lần sau hiện lại, không sao
    }
  }
  const [view, setView] = useState<View>('search')
  const [picks, setPicks] = useState<number[]>([])
  const [extraPicks, setExtraPicks] = useState<number[]>([])

  const [draws, setDraws] = useState<Draw[] | null>(null)
  const [digitDraws, setDigitDraws] = useState<DigitDraw[] | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Max 3D / Max 3D Pro là game dạng số 3 chữ số, dữ liệu & giao diện riêng
  const isDigits = DIGIT_GAMES.some((g) => g.id === gameId)
  // Lưu ý: không gọi getGame(gameId) ở đây vì gameId có thể là game digits

  async function fetchData(id: string, force: boolean) {
    setLoading(true)
    setError(null)
    try {
      if (DIGIT_GAMES.some((g) => g.id === id)) {
        const r = await loadDigitDraws(getDigitGame(id), { forceRefresh: force })
        setDigitDraws(r.draws)
        setDraws(null)
        setFromCache(r.fromCache)
      } else {
        const r = await loadDraws(getGame(id), { forceRefresh: force })
        setDraws(r.draws)
        setDigitDraws(null)
        setFromCache(r.fromCache)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi tải dữ liệu')
      setDraws(null)
      setDigitDraws(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(gameId, false)
  }, [gameId])

  const changeGame = (id: string) => {
    if (id === gameId) return
    setGameId(id)
    setPicks([])
    setExtraPicks([])
    setDraws(null)
    setDigitDraws(null)
  }

  const usePicks = (nums: number[], extra: number | null) => {
    setPicks(nums)
    setExtraPicks(extra === null ? [] : [extra])
    setView('search')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>✨ Dò số Vietlott ✨</h1>
        <p className="subtitle">
          Dò lịch sử · thống kê tần suất · dự đoán bộ số may mắn 🍀
        </p>
      </header>

      {showDisclaimer && (
        <div className="disclaimer">
          <p>
            ⚠️ <b>Lưu ý:</b> Website này là dự án cá nhân,{' '}
            <b>không liên kết với Vietlott</b>. Dữ liệu tổng hợp từ nguồn công
            khai nên có thể thiếu hoặc sai sót; kết quả dò, thống kê, tiền
            thưởng và dự đoán <b>chỉ mang tính tham khảo, giải trí</b> — kết
            quả chính thức luôn theo công bố của Vietlott. Website{' '}
            <b>không chịu trách nhiệm</b> cho bất kỳ quyết định mua vé hay
            thiệt hại nào. Chơi xổ số có trách nhiệm 🍀
          </p>
          <button className="btn-secondary" onClick={dismissDisclaimer}>
            Đã hiểu ✓
          </button>
        </div>
      )}

      <section className="card card-top">
        <div className="game-tabs">
          {[...GAMES, ...DIGIT_GAMES].map((g) => (
            <button
              key={g.id}
              className={'tab' + (g.id === gameId ? ' tab-active' : '')}
              onClick={() => changeGame(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
        <p className="data-status">
          {loading && '⏳ Đang tải dữ liệu…'}
          {!loading && error && (
            <>
              ⚠️ {error} ·{' '}
              <button
                className="btn-link"
                onClick={() => fetchData(gameId, true)}
              >
                Thử lại
              </button>
            </>
          )}
          {!loading &&
            !error &&
            (() => {
              const list = draws ?? digitDraws
              if (!list) return null
              const oldest = list.reduce((a, b) =>
                idNum(a.id) < idNum(b.id) ? a : b,
              )
              const newest = list.reduce((a, b) =>
                idNum(a.id) > idNum(b.id) ? a : b,
              )
              return (
                <>
                  Dữ liệu: {list.length.toLocaleString()} kỳ ({oldest.date} →{' '}
                  {newest.date}){fromCache ? ' · cache' : ' · mới tải'} ·{' '}
                  <button
                    className="btn-link"
                    onClick={() => fetchData(gameId, true)}
                  >
                    Tải lại mới nhất
                  </button>
                </>
              )
            })()}
        </p>
        {!loading &&
          !error &&
          (draws || digitDraws) &&
          (() => {
            const info = isDigits ? getDigitGame(gameId) : getGame(gameId)
            return (
              <p className="rules-line">
                📖 Mới chơi {info.name}? Xem{' '}
                <a href={info.rulesUrl} target="_blank" rel="noreferrer">
                  luật chơi & cơ cấu giải thưởng chính thức
                </a>{' '}
                trên trang Vietlott.
              </p>
            )
          })()}
      </section>

      <nav className="view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={'view-tab' + (v.id === view ? ' view-tab-active' : '')}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {!loading && !isDigits && draws && (
        <div key={gameId}>
          {view === 'search' && (
            <SearchView
              game={getGame(gameId)}
              draws={draws}
              picks={picks}
              setPicks={setPicks}
              extraPicks={extraPicks}
              setExtraPicks={setExtraPicks}
            />
          )}
          {view === 'stats' && (
            <StatsView game={getGame(gameId)} draws={draws} />
          )}
          {view === 'predict' && (
            <PredictView
              game={getGame(gameId)}
              draws={draws}
              onUsePicks={usePicks}
            />
          )}
        </div>
      )}

      {!loading && isDigits && digitDraws && (
        <div key={gameId}>
          {view === 'search' && (
            <DigitsSearchView game={getDigitGame(gameId)} draws={digitDraws} />
          )}
          {view === 'stats' && (
            <DigitsStatsView game={getDigitGame(gameId)} draws={digitDraws} />
          )}
          {view === 'predict' && (
            <section className="card">
              <h2>🎯 Dự đoán — {getDigitGame(gameId).name}</h2>
              <p className="meta">
                Dự đoán cho Max 3D sẽ được bổ sung sau. Trong lúc chờ, bạn có
                thể xem tab 📊 Thống kê: tần suất chữ số theo từng vị trí và
                các bộ ba số ra nhiều nhất để tự chọn số nhé 🍀
              </p>
            </section>
          )}
        </div>
      )}

      <footer className="footer">
        Dữ liệu:{' '}
        <a
          href="https://github.com/vietvudanh/vietlott-data"
          target="_blank"
          rel="noreferrer"
        >
          vietvudanh/vietlott-data
        </a>{' '}
        (cập nhật hàng ngày). Website không liên kết với Vietlott; mọi kết
        quả, thống kê và dự đoán chỉ mang tính tham khảo, giải trí — không
        phải căn cứ trả thưởng và website không chịu trách nhiệm cho quyết
        định của người dùng.
      </footer>

      <GoTop />
    </div>
  )
}
