import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      brandId: string
      outletId: string
      staffId: string | null
      date: string
      taskLabels: string[]
    }) => {
      const { data: v, error } = await supabase
        .from('visits')
        .insert({
          brand_id: input.brandId,
          outlet_id: input.outletId,
          staff_id: input.staffId,
          date: input.date,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw error
      if (input.taskLabels.length) {
        const rows = input.taskLabels.map((label, i) => ({
          visit_id: v.id,
          label,
          done: false,
          sort: i,
        }))
        const { error: tErr } = await supabase.from('visit_tasks').insert(rows)
        if (tErr) throw tErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useToggleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; done: boolean }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ done: input.done })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useMarkVisitDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ done: true })
        .eq('visit_id', input.visitId)
      if (error) throw error
      const { error: fErr } = await supabase
        .from('visits')
        .update({ status: 'done' })
        .eq('id', input.visitId)
      if (fErr) throw fErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useToggleVisitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; status: 'done' | 'pending' }) => {
      const next = input.status === 'done' ? 'pending' : 'done'
      const { error } = await supabase
        .from('visits')
        .update({ status: next })
        .eq('id', input.visitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
