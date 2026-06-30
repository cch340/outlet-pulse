import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { mapMissingLabelVisit, type MissingLabelVisit } from './dashboardSummary'

export const MISSING_LABEL_LIMIT = 200

export function useVisitsMissingLabel(label: string): {
  visits: MissingLabelVisit[]
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visitsMissingLabel({ label, limit: MISSING_LABEL_LIMIT }),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visits_missing_label', {
        p_label: label,
        p_limit: MISSING_LABEL_LIMIT,
      })
      if (error) throw error
      return ((data ?? []) as unknown[]).map(mapMissingLabelVisit)
    },
  })
  return { visits: query.data ?? [], isLoading: query.isLoading, isError: query.isError }
}
