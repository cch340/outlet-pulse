import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapDashboardSummary, EMPTY_SUMMARY, type DashboardSummary } from './dashboardSummary'

export interface DashboardParams {
  today: string
  year: string
  month: string
  listLimit: number
}

export function useDashboardSummary(p: DashboardParams): {
  summary: DashboardSummary
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.dashboardSummary(p),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_summary', {
        p_today: p.today,
        p_year: p.year,
        p_month: p.month,
        p_list_limit: p.listLimit,
      })
      if (error) throw error
      return mapDashboardSummary(data)
    },
  })
  return { summary: query.data ?? EMPTY_SUMMARY, isLoading: query.isLoading, isError: query.isError }
}
