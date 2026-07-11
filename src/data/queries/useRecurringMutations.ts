import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import type { Frequency, RecurringSchedule } from '../model'

export function useCreateRecurringSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      brandId: string
      outletId: string
      staffId: string | null
      frequency: Frequency
      startDate: string
      taskLabels: string[]
      /** Days before an occurrence to materialize its visit (0–30). */
      leadDays: number
      /** Occurrence already materialized (e.g. the first visit created inline). */
      lastGenerated?: string | null
    }) => {
      const { error } = await supabase.from('recurring_schedules').insert({
        brand_id: input.brandId,
        outlet_id: input.outletId,
        staff_id: input.staffId,
        frequency: input.frequency,
        start_date: input.startDate,
        task_labels: input.taskLabels,
        lead_days: input.leadDays,
        last_generated: input.lastGenerated ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringSchedules }),
  })
}

export function useSetRecurringActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('recurring_schedules')
        .update({ active: input.active })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringSchedules }),
  })
}

export function useDeleteRecurringSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from('recurring_schedules').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurringSchedules }),
  })
}

/**
 * Materialize the given occurrence dates of a schedule into real visits: one
 * `visits` row per date plus its `visit_tasks` from the schedule's task_labels
 * (mirroring useCreateVisit's insert shape), then advance `last_generated` to
 * the latest date so those occurrences are never generated again.
 */
export function useGenerateDueVisits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { schedule: RecurringSchedule; dates: string[] }) => {
      const { schedule, dates } = input
      if (!dates.length) return
      for (const date of dates) {
        const { data: v, error } = await supabase
          .from('visits')
          .insert({
            brand_id: schedule.brandId,
            outlet_id: schedule.outletId,
            staff_id: schedule.staffId,
            date,
          })
          .select('id')
          .single()
        if (error) throw error
        if (schedule.taskLabels.length) {
          const rows = schedule.taskLabels.map((label, i) => ({
            visit_id: v.id,
            label,
            status: 'pending',
            sort: i,
          }))
          const { error: tErr } = await supabase.from('visit_tasks').insert(rows)
          if (tErr) throw tErr
        }
      }
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))
      const { error: uErr } = await supabase
        .from('recurring_schedules')
        .update({ last_generated: maxDate })
        .eq('id', schedule.id)
      if (uErr) throw uErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.visits })
      qc.invalidateQueries({ queryKey: queryKeys.recurringSchedules })
    },
  })
}
