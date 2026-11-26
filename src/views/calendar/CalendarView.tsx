/**
 * Kalenteri (plan section 3): gigs in month, week and list views. Monday first, ISO
 * week numbers, Finnish texts, Europe/Helsinki. Tentative gigs are hatched and
 * labelled, gigs with conflicts carry a marker. A click on a gig opens it; a click on
 * a day starts a new gig on that day.
 */
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import FullCalendar, {
  joinClassNames,
  useCalendarController,
  type CalendarOptions,
  type DatesSetInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import listPlugin from '@fullcalendar/react/list'
import fiLocale from '@fullcalendar/react/locales/fi'
import classicTheme from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { Group, Stack, Switch, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAppData } from '../../app/appData'
import { HELSINKI } from '../../core/time'
import classes from './calendar.module.css'
import { CalendarToolbar } from './CalendarToolbar'
import { EventContent } from './EventContent'
import { calendarEntries, entryOf, isoDateOf, newGigPath, toEventInputs } from './events'
import { Legend } from './Legend'
import { t } from './texts'
import {
  lastDayOf,
  modeOfView,
  periodTitle,
  readViewState,
  VIEW_OF_MODE,
  writeViewState,
  type ViewState,
} from './viewState'

/** Options that never change between renders. */
const STATIC_OPTIONS: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, classicTheme],
  locale: 'fi',
  locales: [fiLocale],
  timeZone: HELSINKI,
  firstDay: 1,
  weekNumbers: true,
  weekNumberCalculation: 'ISO',
  headerToolbar: false,
  navLinks: true,
  nowIndicator: true,
  eventDisplay: 'block',
  eventTimeFormat: { hour: 'numeric', minute: '2-digit' },
  displayEventEnd: false,
  dayMaxEvents: 4,
  noEventsText: t.noEvents,
  moreLinkText: (n) => t.more(n),
  moreLinkHint: (n) => t.moreHint(n),
  weekTextLong: t.weekLong,
  // Week numbers open that week; days start a new gig (see navLinkDayClick).
  navLinkWeekClick: VIEW_OF_MODE.viikko,
  navLinkHint: (dateText) =>
    dateText.startsWith(t.weekLong) ? t.showWeek(dateText) : t.newGigOn(dateText),
  inlineWeekNumberContent: ({ num, isNarrow }) => (isNarrow ? String(num) : t.week(num)),
  weekNumberHeaderContent: ({ num }) => (num === undefined ? t.weekShort : t.week(num)),
  eventContent: (arg) => <EventContent arg={arg} />,
  // Block events (month, week) are filled with the status colour; list rows are not.
  eventClass: (arg) => {
    const entry = entryOf(arg.event.extendedProps)
    if (!entry || arg.view.type.startsWith('list')) return undefined
    return joinClassNames(classes.event, classes[entry.status])
  },
  listItemEventClass: (arg) => {
    const entry = entryOf(arg.event.extendedProps)
    return entry ? joinClassNames(classes.listEvent, classes[entry.status]) : undefined
  },
  // The list row shows its own status swatch instead of the coloured dot.
  listItemEventBeforeClass: classes.hidden,
  views: {
    dayGridMonth: { height: 'auto' },
    timeGridWeek: {
      contentHeight: 640,
      scrollTime: '07:00:00',
      allDaySlot: false,
      dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'numeric' },
    },
    listTwoWeeks: {
      type: 'list',
      duration: { weeks: 2 },
      height: 'auto',
      listDayFormat: { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' },
      listDayAltFormat: false,
    },
  },
}

/** What the calendar shows now: the mode and the period's first and last day. */
interface Shown extends ViewState {
  last: string | undefined
}

export function CalendarView() {
  const app = useAppData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const wide = useMediaQuery('(min-width: 48em)', undefined, { getInitialValueInEffect: false })
  const [initial] = useState(() => readViewState(params, wide))
  const [shown, setShown] = useState<Shown>({ ...initial, last: undefined })
  const controller = useCalendarController()
  const showCancelled = params.get('perutut') === '1'

  const events = useMemo(
    () => toEventInputs(calendarEntries(app.data.gigs, app.availability, { showCancelled })),
    [app.data.gigs, app.availability, showCancelled],
  )

  // FullCalendar reports its period while rendering; the address follows in an effect.
  const onDatesSet = (info: DatesSetInfo) => {
    const api = info.view.calendar
    setShown({
      mode: modeOfView(info.view.type) ?? shown.mode,
      date: isoDateOf(api.formatIso(info.view.currentStart, true)) ?? undefined,
      last: lastDayOf(api.formatIso(info.view.currentEnd, true).slice(0, 10)),
    })
  }
  useEffect(() => {
    setParams((prev) => writeViewState(prev, { mode: shown.mode, date: shown.date }), {
      replace: true,
    })
  }, [shown.mode, shown.date, setParams])

  const setShowCancelled = (on: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (on) next.set('perutut', '1')
        else next.delete('perutut')
        return next
      },
      { replace: true },
    )

  const newGigOn = (dateStr: string) => {
    const day = isoDateOf(dateStr)
    if (day) void navigate(newGigPath(day))
  }

  return (
    <Stack gap="sm" className={classes.root}>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>{t.title}</Title>
        <Switch
          label={t.showCancelled}
          checked={showCancelled}
          onChange={(e) => setShowCancelled(e.currentTarget.checked)}
          size="md"
        />
      </Group>
      <CalendarToolbar
        title={periodTitle(shown.mode, shown.date ?? '', shown.last ?? '')}
        mode={shown.mode}
        wide={wide}
        onModeChange={(m) => controller.changeView(VIEW_OF_MODE[m])}
        onPrev={() => controller.prev()}
        onNext={() => controller.next()}
        onToday={() => controller.today()}
      />
      <FullCalendar
        {...STATIC_OPTIONS}
        controller={controller}
        now={app.now}
        initialView={VIEW_OF_MODE[initial.mode]}
        {...(initial.date ? { initialDate: initial.date } : {})}
        events={events}
        datesSet={onDatesSet}
        eventClick={(info) => {
          info.jsEvent.preventDefault()
          const entry = entryOf(info.event.extendedProps)
          if (entry) void navigate(`/keikat/${encodeURIComponent(entry.gigId)}`)
        }}
        dateClick={(info) => newGigOn(info.dateStr)}
        navLinkDayClick={(date) => newGigOn(controller.view?.calendar.formatIso(date, true) ?? '')}
      />
      <Legend showCancelled={showCancelled} />
    </Stack>
  )
}
