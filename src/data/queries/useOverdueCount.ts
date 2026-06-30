import { useVisitStatusCounts } from './useVisitsPage'
import { today, localDateStr } from '../derived'

/** Total overdue visits across all time — backs the nav badge. */
export function useOverdueCount(): number {
  const counts = useVisitStatusCounts({ today: localDateStr(today()), from: null, to: null, latest: false, search: '', brand: null, outlet: null })
  return counts.overdue
}
