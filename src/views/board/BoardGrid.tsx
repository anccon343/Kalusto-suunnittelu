/** The board itself: a sticky header row of days and one row per item, grouped by category. */
import { Fragment } from 'react'
import { formatShortDate, formatWeek, weekdayIndex } from '../../core/time'
import type { Item } from '../../core/types'
import classes from './Board.module.css'
import { DeviceRow, QuantityRow } from './BoardRows'
import type { BoardDay } from './layout'
import { sameDate } from './period'
import type { RowLayout } from './rows'
import { t } from './texts'

export interface BoardGridProps {
  days: readonly BoardDay[]
  today: BoardDay['date']
  items: readonly Item[]
  rowOf: (item: Item) => RowLayout
}

export function BoardGrid({ days, today, items, rowOf }: BoardGridProps) {
  const columns = days.length
  return (
    <div className={classes.scroller}>
      <div
        className={classes.grid}
        role="table"
        aria-label={t.boardLabel}
        aria-colcount={columns + 1}
        style={{
          gridTemplateColumns: `var(--label-w) repeat(${columns}, minmax(4.5rem, 1fr))`,
        }}
      >
        <div className={classes.headRow} role="row">
          <div className={classes.corner} role="columnheader">
            {t.equipmentColumn}
          </div>
          {days.map((d) => (
            <DayHeader key={d.start} day={d} isToday={sameDate(d.date, today)} />
          ))}
        </div>
        {items.map((item, i) => {
          const prev = items[i - 1]
          const layout = rowOf(item)
          return (
            <Fragment key={item.id}>
              {prev?.category !== item.category && (
                <div className={classes.categoryRow} role="row">
                  <div className={classes.categoryName} role="rowheader">
                    {item.category}
                  </div>
                </div>
              )}
              {layout.kind === 'device' ? (
                <DeviceRow item={item} layout={layout} columns={columns} />
              ) : (
                <QuantityRow item={item} layout={layout} days={days} />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function DayHeader({ day, isToday }: { day: BoardDay; isToday: boolean }) {
  const weekday = weekdayIndex(day.date)
  return (
    <div
      className={classes.dayHead}
      role="columnheader"
      data-today={isToday || undefined}
      data-weekend={weekday >= 5 || undefined}
      aria-current={isToday ? 'date' : undefined}
    >
      {weekday === 0 && <span className={classes.week}>{formatWeek(day.start)}</span>}
      <span>{formatShortDate(day.start)}</span>
      {isToday && <span>{t.todayMarker}</span>}
    </div>
  )
}
