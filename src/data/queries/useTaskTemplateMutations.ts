import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { label: string; sort: number }) => {
      const { error } = await supabase
        .from('task_templates')
        .insert({ label: input.label, sort: input.sort })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useRenameTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; label: string }) => {
      const { error } = await supabase
        .from('task_templates')
        .update({ label: input.label })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from('task_templates').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useReorderTaskTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      // Persist new order by writing each row's index as its sort value.
      for (let i = 0; i < input.ids.length; i++) {
        const { error } = await supabase
          .from('task_templates')
          .update({ sort: i })
          .eq('id', input.ids[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}
