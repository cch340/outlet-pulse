import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Visit } from '../model'
import { rowToVisit } from './mappers'
import { queryKeys } from './keys'

/** Max visits fetched per staff for the performance analytics — the most-recent
 *  500. Stats therefore reflect at most this many visits. */
export const STAFF_VISITS_CAP = 500

/**
 * All visits assigned to a staff member (staff_id === staffId), most-recent
 * first. Only enabled when a staffId is supplied (the detail modal is open).
 * Unassigned visits are excluded by the `.eq('staff_id', …)` filter.
 */
export function useStaffVisits(staffId: string | null): {
  visits: Visit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.staffVisits(staffId),
    enabled: staffId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, visit_tasks(*)')
        .eq('staff_id', staffId!)
        .order('date', { ascending: false })
        .limit(STAFF_VISITS_CAP)
      if (error) throw error
      return (data ?? []).map(rowToVisit)
    },
  })
  return {
    visits: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
