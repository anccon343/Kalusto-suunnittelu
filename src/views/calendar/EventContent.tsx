/** What one gig looks like inside the calendar: conflict marker, status, time and name. */
import { VisuallyHidden } from '@mantine/core'
import type { EventDisplayInfo } from '@fullcalendar/react'
import classes from './calendar.module.css'
import { dayPart, entryOf, listTimeText, type CalendarEntry, type ConflictLevel } from './events'
import { t } from './texts'

/** "!" (or "! Päällekkäin" with room). Red is filled, yellow outlined, so shape differs too. */
export function ConflictMarker({ level, long }: { level: ConflictLevel; long: boolean }) {
  return (
    <span className={classes.marker} data-level={level} aria-hidden="true">
      {long ? `! ${t.conflict[level]}` : '!'}
    </span>
  )
}

export function EventContent({ arg }: { arg: EventDisplayInfo }) {
  const entry = entryOf(arg.event.extendedProps)
  if (!entry) return null
  const view = viewKind(arg.view.type)
  return (
    <span className={classes.content} data-view={view} title={entry.label}>
      {/* One readable name for screen readers; the visible parts are shorthand. */}
      <VisuallyHidden>{entry.label}</VisuallyHidden>
      {view === 'list' ? (
        <ListRow entry={entry} timeText={listTimeText(entry, dayPart(arg.isStart, arg.isEnd))} />
      ) : (
        <GridItem
          entry={entry}
          timeText={arg.isNarrow ? '' : arg.timeText}
          stacked={view === 'time'}
        />
      )}
    </span>
  )
}

type ViewKind = 'month' | 'time' | 'list'

const viewKind = (type: string): ViewKind =>
  type.startsWith('list') ? 'list' : type.startsWith('timeGrid') ? 'time' : 'month'

/**
 * Month and week views: "! 10.00 alust. Hybridiseminaari" on one line, or with the
 * name on its own line in the week view's tall blocks.
 */
function GridItem(p: { entry: CalendarEntry; timeText: string; stacked: boolean }) {
  const { entry } = p
  const tag = t.statusTag[entry.status]
  const title = <span className={classes.title}>{entry.title}</span>
  return (
    <>
      <span className={classes.line} aria-hidden="true">
        {entry.conflict && <ConflictMarker level={entry.conflict} long={false} />}
        {p.timeText && <span className={classes.time}>{p.timeText}</span>}
        {tag && <span className={classes.tag}>{tag}</span>}
        {!p.stacked && title}
      </span>
      {p.stacked && (
        <span className={classes.line} aria-hidden="true">
          {title}
        </span>
      )}
    </>
  )
}

/** List view: time and name on the first line, status and conflict in words below. */
function ListRow({ entry, timeText }: { entry: CalendarEntry; timeText: string }) {
  return (
    <>
      <span className={classes.line} aria-hidden="true">
        <span className={classes.time}>{timeText}</span>
        <span className={classes.title}>{entry.title}</span>
      </span>
      <span className={classes.line} aria-hidden="true">
        <span className={classes.swatch} data-status={entry.status} />
        <span className={classes.tag}>{t.status[entry.status]}</span>
        {entry.conflict && <ConflictMarker level={entry.conflict} long />}
      </span>
    </>
  )
}
