import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Visit } from '../model'
import { rowToVisit } from './mappers'
import { queryKeys } from './keys'

export function useVisit(id: string | null): {
  visit: Visit | null
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visit(id),
    enabled: id != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, visit_tasks(*)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? rowToVisit(data) : null
    },
  })
  return { visit: query.data ?? null, isLoading: query.isLoading, isError: query.isError }
}
