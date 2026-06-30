import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import type { TaskStatus } from '../model'

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
      if (!input.taskLabels.length) throw new Error('A visit needs at least one task')
      const { data: v, error } = await supabase
        .from('visits')
        .insert({
          brand_id: input.brandId,
          outlet_id: input.outletId,
          staff_id: input.staffId,
          date: input.date,
        })
        .select('id')
        .single()
      if (error) throw error
      const rows = input.taskLabels.map((label, i) => ({
        visit_id: v.id,
        label,
        status: 'pending',
        sort: i,
      }))
      const { error: tErr } = await supabase.from('visit_tasks').insert(rows)
      if (tErr) throw tErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useSetTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ status: input.status })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useSetTaskRemark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; remark: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ remark: input.remark })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useMarkAllSuccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ status: 'success' })
        .eq('visit_id', input.visitId)
        .eq('status', 'pending')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
