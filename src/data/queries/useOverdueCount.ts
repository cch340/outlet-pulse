import { useVisitStatusCounts } from './useVisitsPage'
import { today } from '../derived'

const pad = (n: number) => String(n).padStart(2, '0')

/** Total overdue visits across all time — backs the nav badge. */
export function useOverdueCount(): number {
  const t = today()
  const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  const counts = useVisitStatusCounts({ today: todayStr, from: null, to: null, latest: false, search: '' })
  return counts.overdue
}
