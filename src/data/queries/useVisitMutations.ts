import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { photoPathsForTasks, removeObjectsQuietly } from './useTaskPhotos'
import { chunk } from '../listFilter'
import type { TaskStatus } from '../model'

// Keep `.in(...)` / `.delete().in(...)` lists short enough to stay under
// URL-length limits (mirrors the constant in useTaskPhotos).
const IN_CHUNK = 500

/** Every task id belonging to the given visits (chunked to stay under URL limits). */
async function taskIdsForVisits(visitIds: string[]): Promise<string[]> {
  const out: string[] = []
  for (const ids of chunk(visitIds, IN_CHUNK)) {
    const { data, error } = await supabase.from('visit_tasks').select('id').in('visit_id', ids)
    if (error) throw error
    for (const r of (data as { id: string }[]) ?? []) out.push(r.id)
  }
  return out
}

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

export function useDeleteVisit() {
  const qc = useQueryClient()
  return useMutation({
    // visit_tasks.visit_id is ON DELETE CASCADE, so removing the visits row
    // drops its tasks too (see migrations 0001 + 0004), and task_photos rows
    // cascade with the tasks (0016). The storage objects can't cascade in
    // Postgres, so remove them client-side first (best-effort).
    mutationFn: async (input: { visitId: string }) => {
      const taskIds = await taskIdsForVisits([input.visitId])
      await removeObjectsQuietly(await photoPathsForTasks(taskIds))

      const { error } = await supabase.from('visits').delete().eq('id', input.visitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

/**
 * Mark every pending task across the selected visits as success in one batched
 * update (chunked by visit id): `update visit_tasks set status='success' where
 * visit_id in (...) and status='pending'`.
 */
export function useBulkMarkDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitIds: string[] }) => {
      if (!input.visitIds.length) return
      for (const ids of chunk(input.visitIds, IN_CHUNK)) {
        const { error } = await supabase
          .from('visit_tasks')
          .update({ status: 'success' })
          .in('visit_id', ids)
          .eq('status', 'pending')
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

/**
 * Delete the selected visits. Tasks + task_photos rows cascade with the visit
 * (0004 / 0016), but the photo storage objects can't cascade in Postgres, so
 * remove them client-side first (best-effort, same as {@link useDeleteVisit}).
 */
export function useBulkDeleteVisits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitIds: string[] }) => {
      if (!input.visitIds.length) return
      const taskIds = await taskIdsForVisits(input.visitIds)
      await removeObjectsQuietly(await photoPathsForTasks(taskIds))
      for (const ids of chunk(input.visitIds, IN_CHUNK)) {
        const { error } = await supabase.from('visits').delete().in('id', ids)
        if (error) throw error
      }
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

export function useAddTaskToVisits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { label: string; visitIds: string[] }) => {
      const label = input.label.trim()
      if (!label || !input.visitIds.length) return
      // Each visit gets the task appended after its current last task, so we
      // compute the next sort per visit from the existing rows.
      const { data: rows, error: qErr } = await supabase
        .from('visit_tasks')
        .select('visit_id, sort')
        .in('visit_id', input.visitIds)
      if (qErr) throw qErr
      const maxSort = new Map<string, number>()
      for (const r of rows ?? []) {
        const cur = maxSort.get(r.visit_id)
        if (cur === undefined || r.sort > cur) maxSort.set(r.visit_id, r.sort)
      }
      const inserts = input.visitIds.map((visitId) => {
        const max = maxSort.get(visitId)
        return {
          visit_id: visitId,
          label,
          status: 'pending',
          remark: '',
          sort: max === undefined ? 0 : max + 1,
        }
      })
      const { error } = await supabase.from('visit_tasks').insert(inserts)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useRemoveVisitTask() {
  const qc = useQueryClient()
  return useMutation({
    // task_photos rows cascade with the task (0016), but their storage objects
    // must be removed client-side first (best-effort — orphans are tolerable).
    mutationFn: async (input: { taskId: string }) => {
      await removeObjectsQuietly(await photoPathsForTasks([input.taskId]))
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
