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

export function useUpdateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      visitId: string
      brandId?: string
      outletId?: string
      staffId?: string | null
      date?: string
    }) => {
      const patch: Record<string, unknown> = {}
      if (input.brandId !== undefined) patch.brand_id = input.brandId
      if (input.outletId !== undefined) patch.outlet_id = input.outletId
      if (input.staffId !== undefined) patch.staff_id = input.staffId
      if (input.date !== undefined) patch.date = input.date
      const { error } = await supabase.from('visits').update(patch).eq('id', input.visitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useAddVisitTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; label: string }) => {
      const { data: rows, error: qErr } = await supabase
        .from('visit_tasks')
        .select('sort')
        .eq('visit_id', input.visitId)
        .order('sort', { ascending: false })
        .limit(1)
      if (qErr) throw qErr
      const nextSort = rows && rows.length ? rows[0].sort + 1 : 0
      const { error } = await supabase.from('visit_tasks').insert({
        visit_id: input.visitId,
        label: input.label,
        status: 'pending',
        remark: '',
        sort: nextSort,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useRemoveVisitTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string }) => {
      const { error } = await supabase.from('visit_tasks').delete().eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useImportVisitTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; labels: string[] }) => {
      if (!input.labels.length) return
      const { data: rows, error: qErr } = await supabase
        .from('visit_tasks')
        .select('sort')
        .eq('visit_id', input.visitId)
        .order('sort', { ascending: false })
        .limit(1)
      if (qErr) throw qErr
      const base = rows && rows.length ? rows[0].sort + 1 : 0
      const inserts = input.labels.map((label, i) => ({
        visit_id: input.visitId,
        label: label.trim(),
        status: 'pending',
        remark: '',
        sort: base + i,
      }))
      const { error } = await supabase.from('visit_tasks').insert(inserts)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
