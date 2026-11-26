/** One board row per item: bars for a device, per-day free quantities for a quantity item. */
import { memo, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CONDITION_SRC } from '../../core/availability'
import { formatShortDate } from '../../core/time'
import type { Item } from '../../core/types'
import classes from './Board.module.css'
import type { Bar, BoardDay, ConflictMark } from './layout'
import {
  barDescription,
  barText,
  conditionText,
  rangeText,
  type DeviceRowLayout,
  type QuantityCell,
  type QuantityRowLayout,
} from './rows'
import { t } from './texts'

/** Horizontal placement of a fractional column range inside the track. */
function span(startCol: number, endCol: number, columns: number): CSSProperties {
  return {
    left: `${(startCol / columns) * 100}%`,
    width: `${((endCol - startCol) / columns) * 100}%`,
  }
}

function RowLabel({ item }: { item: Item }) {
  return (
    <div className={classes.label} role="rowheader">
      <Link to={`/kalusto/${item.id}`} className={classes.labelLink}>
        <span className={classes.tag}>{item.tag}</span>
        {item.name !== item.tag && <span className={classes.name}>{item.name}</span>}
        {item.quantity > 1 && <span className={classes.name}>{t.pieces(item.quantity)}</span>}
        {item.condition !== 'ok' && (
          <span className={classes.labelNote} title={conditionText(item)}>
            {t.condition[item.condition]}
          </span>
        )}
      </Link>
    </div>
  )
}

function BarLink({
  bar,
  item,
  columns,
  top,
}: {
  bar: Bar
  item: Item
  columns: number
  top: number
}) {
  const description = barDescription(bar)
  const to = bar.src === CONDITION_SRC ? `/kalusto/${item.id}` : `/keikat/${bar.src}`
  return (
    <Link
      to={to}
      className={`${classes.bar} ${classes[bar.kind]}`}
      style={{ ...span(bar.startCol, bar.endCol, columns), top }}
      aria-label={description}
      title={description}
      data-clipped-start={bar.clippedStart || undefined}
      data-clipped-end={bar.clippedEnd || undefined}
    >
      <span className={`${classes.barText} ${bar.transferIn ? classes.transfer : ''}`}>
        {barText(bar)}
      </span>
    </Link>
  )
}

function Mark({
  mark,
  columns,
  lanesHeight,
}: {
  mark: ConflictMark
  columns: number
  lanesHeight: string
}) {
  const label = mark.severity === 'red' ? t.overlap : t.warning
  const description = t.markAria(label, rangeText(mark.start, mark.end))
  const pos = span(mark.startCol, mark.endCol, columns)
  return (
    <>
      <div className={classes.mark} data-severity={mark.severity} style={pos} title={description}>
        {label}
      </div>
      <div
        className={classes.outline}
        data-severity={mark.severity}
        style={{ ...pos, top: 'var(--strip-h)', height: lanesHeight }}
        aria-hidden
      />
    </>
  )
}

const LANE_PX = 44
const STRIP_PX = 20

export const DeviceRow = memo(function DeviceRow({
  item,
  layout,
  columns,
}: {
  item: Item
  layout: DeviceRowLayout
  columns: number
}) {
  const strip = layout.marks.length > 0 ? STRIP_PX : 0
  const lanesHeight = `${layout.lanes * LANE_PX}px`
  return (
    <div className={classes.row} role="row">
      <RowLabel item={item} />
      <div
        className={classes.track}
        role="cell"
        aria-colspan={columns}
        style={{
          height: strip + layout.lanes * LANE_PX,
          backgroundSize: `${100 / columns}% 100%`,
        }}
      >
        {layout.marks.map((m) => (
          <Mark key={m.key} mark={m} columns={columns} lanesHeight={lanesHeight} />
        ))}
        {layout.bars.map((b) => (
          <BarLink
            key={b.key}
            bar={b}
            item={item}
            columns={columns}
            top={strip + b.lane * LANE_PX + 3}
          />
        ))}
      </div>
    </div>
  )
})

function cellState(c: QuantityCell): 'red' | 'yellow' | 'empty' | undefined {
  if (c.severity) return c.severity
  return c.free <= 0 ? 'empty' : undefined
}

const cellNote = {
  red: t.overlap,
  yellow: t.warning,
  empty: t.soldOut,
} as const

export const QuantityRow = memo(function QuantityRow({
  item,
  layout,
  days,
}: {
  item: Item
  layout: QuantityRowLayout
  days: readonly BoardDay[]
}) {
  return (
    <div className={classes.row} role="row">
      <RowLabel item={item} />
      {layout.cells.map((c, i) => {
        const state = cellState(c)
        const day = days[i]
        return (
          <div
            key={day ? day.start : i}
            className={classes.cell}
            role="cell"
            data-state={state}
            title={day ? t.freeAria(formatShortDate(day.start), c.free, c.capacity) : undefined}
          >
            <span>{t.free(c.free, c.capacity)}</span>
            {state && <span className={classes.cellNote}>{cellNote[state]}</span>}
          </div>
        )
      })}
    </div>
  )
})
