import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Visit } from '../model'
import { rowToVisit } from './mappers'
import { queryKeys } from './keys'
import { orderByIds, foldStatusCounts, type StatusCounts } from './visitsQuery'

export interface VisitsPageParams {
  today: string
  from: string | null
  to: string | null
  status: string
  latest: boolean
  search: string
  limit: number
  offset: number
}

export function useVisitsPage(p: VisitsPageParams): {
  visits: Visit[]
  total: number
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: queryKeys.visitsPage(p),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: pageRows, error } = await supabase.rpc('visits_page', {
        p_today: p.today,
        p_from: p.from,
        p_to: p.to,
        p_status: p.status,
        p_latest: p.latest,
        p_search: p.search,
        p_limit: p.limit,
        p_offset: p.offset,
      })
      if (error) throw error
      const rows = (pageRows ?? []) as { id: string; total_count: number }[]
      if (rows.length === 0) return { visits: [] as Visit[], total: 0 }
      const ids = rows.map((r) => r.id)
      const total = Number(rows[0].total_count)
      const { data: vRows, error: vErr } = await supabase
        .from('visits')
        .select('*, visit_tasks(*)')
        .in('id', ids)
      if (vErr) throw vErr
      const visits = orderByIds((vRows ?? []).map(rowToVisit), ids)
      return { visits, total }
    },
  })
  return {
    visits: query.data?.visits ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export interface CountsParams {
  today: string
  from: string | null
  to: string | null
  latest: boolean
  search: string
}

const ZERO_COUNTS: StatusCounts = { all: 0, pending: 0, attention: 0, overdue: 0, done: 0 }

export function useVisitStatusCounts(p: CountsParams): StatusCounts {
  const query = useQuery({
    queryKey: queryKeys.visitStatusCounts(p),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visit_status_counts', {
        p_today: p.today,
        p_from: p.from,
        p_to: p.to,
        p_latest: p.latest,
        p_search: p.search,
      })
      if (error) throw error
      return foldStatusCounts((data ?? []) as { status: string; n: number }[])
    },
  })
  return query.data ?? ZERO_COUNTS
}
