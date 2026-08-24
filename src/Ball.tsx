export type BallColor = 'gold' | 'green'

export default function Ball({
  number,
  highlight = false,
  color,
  className = '',
}: {
  number: number
  highlight?: boolean // true = bóng được tô đầy (trúng / số của người chơi)
  color?: BallColor // bóng số phụ: vàng (6/55) hoặc xanh lá (5/35)
  className?: string
}) {
  return (
    <span
      className={
        'ball' +
        (color ? ` ball-${color}` : '') +
        (highlight ? ' ball-hit' : '') +
        (className ? ` ${className}` : '')
      }
    >
      {String(number).padStart(2, '0')}
    </span>
  )
}
