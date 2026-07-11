import { useEffect, useRef } from 'react'
import { useData } from './useData'
import { useGenerateDueVisits } from './useRecurringMutations'
import { dueOccurrences } from '../recurrence'
import { today, localDateStr } from '../derived'
import { useToast } from '../../components/ToastProvider'

/**
 * Once per app session (after data first loads), materialize any due occurrences
 * of the active recurring schedules into real visits, then surface a single
 * summary toast. A ref guards against re-running and against re-entry while the
 * generation mutations are still in flight.
 */
export function useAutoGenerateVisits(): void {
  const { data, isLoading } = useData()
  const generate = useGenerateDueVisits()
  const toast = useToast()
  const ranRef = useRef(false)

  useEffect(() => {
    if (isLoading || ranRef.current) return
    ranRef.current = true // claim the run immediately so we never re-enter

    const todayISO = localDateStr(today())
    const jobs = data.recurringSchedules
      .filter((s) => s.active)
      .map((schedule) => ({ schedule, dates: dueOccurrences(schedule, todayISO) }))
      .filter((j) => j.dates.length > 0)
    if (!jobs.length) return

    const total = jobs.reduce((n, j) => n + j.dates.length, 0)
    ;(async () => {
      for (const job of jobs) await generate.mutateAsync(job)
      toast.success(`Created ${total} scheduled visit(s) from recurring schedules.`)
    })().catch((e: unknown) => {
      toast.error("Couldn't create scheduled visits: " + (e instanceof Error ? e.message : String(e)))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])
}
