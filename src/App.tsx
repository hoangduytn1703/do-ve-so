import { useEffect, useState } from 'react'
import { GAMES, getGame, loadDraws, type Draw } from './games.ts'
import SearchView from './SearchView.tsx'
import StatsView from './StatsView.tsx'
import PredictView from './PredictView.tsx'
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
  const [fromCache, setFromCache] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const game = getGame(gameId)

  async function fetchData(id: string, force: boolean) {
    setLoading(true)
    setError(null)
    try {
      const r = await loadDraws(getGame(id), { forceRefresh: force })
      setDraws(r.draws)
      setFromCache(r.fromCache)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi tải dữ liệu')
      setDraws(null)
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
          {GAMES.map((g) => (
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
          {!loading && !error && draws && (
            <>
              Dữ liệu: {draws.length.toLocaleString()} kỳ (
              {draws.reduce((a, b) =>
                parseInt(a.id, 10) < parseInt(b.id, 10) ? a : b,
              ).date}{' '}
              →{' '}
              {
                draws.reduce((a, b) =>
                  parseInt(a.id, 10) > parseInt(b.id, 10) ? a : b,
                ).date
              }
              ){fromCache ? ' · cache' : ' · mới tải'} ·{' '}
              <button
                className="btn-link"
                onClick={() => fetchData(gameId, true)}
              >
                Tải lại mới nhất
              </button>
            </>
          )}
        </p>
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

      {draws && !loading && (
        <div key={gameId}>
          {view === 'search' && (
            <SearchView
              game={game}
              draws={draws}
              picks={picks}
              setPicks={setPicks}
              extraPicks={extraPicks}
              setExtraPicks={setExtraPicks}
            />
          )}
          {view === 'stats' && <StatsView game={game} draws={draws} />}
          {view === 'predict' && (
            <PredictView game={game} draws={draws} onUsePicks={usePicks} />
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
    </div>
  )
}
