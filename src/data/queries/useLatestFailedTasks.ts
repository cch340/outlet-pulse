import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapLatestFailedTasks, type LatestFailedVisit } from './dashboardSummary'

export function useLatestFailedTasks(month: string): {
  rows: LatestFailedVisit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.latestFailedTasks(month),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('latest_failed_tasks', { p_month: month })
      if (error) throw error
      return mapLatestFailedTasks(data)
    },
  })
  return { rows: query.data ?? [], isLoading: query.isLoading, isError: query.isError }
}
