import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      brandId: string
      outletId: string
      staffId: string | null
      date: string
      taskLabels: string[]
    }) => {
      const { data: fu, error } = await supabase
        .from('follow_ups')
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
          follow_up_id: fu.id,
          label,
          done: false,
          sort: i,
        }))
        const { error: tErr } = await supabase.from('follow_up_tasks').insert(rows)
        if (tErr) throw tErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useToggleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; done: boolean }) => {
      const { error } = await supabase
        .from('follow_up_tasks')
        .update({ done: input.done })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useMarkFollowUpDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { followUpId: string }) => {
      const { error } = await supabase
        .from('follow_up_tasks')
        .update({ done: true })
        .eq('follow_up_id', input.followUpId)
      if (error) throw error
      const { error: fErr } = await supabase
        .from('follow_ups')
        .update({ status: 'done' })
        .eq('id', input.followUpId)
      if (fErr) throw fErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}

export function useToggleFollowUpStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { followUpId: string; status: 'done' | 'pending' }) => {
      const next = input.status === 'done' ? 'pending' : 'done'
      const { error } = await supabase
        .from('follow_ups')
        .update({ status: next })
        .eq('id', input.followUpId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followups }),
  })
}
