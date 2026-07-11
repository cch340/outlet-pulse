import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; location: string; sort: number }) => {
      const { error } = await supabase.from('outlets').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.outlets }),
  })
}

export function useUpdateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; location: string }) => {
      const { id, ...fields } = input
      const { error } = await supabase.from('outlets').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.outlets }),
  })
}

export function useReorderOutlets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      // Persist new order by writing each row's index as its sort value.
      for (let i = 0; i < input.ids.length; i++) {
        const { error } = await supabase.from('outlets').update({ sort: i }).eq('id', input.ids[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.outlets }),
  })
}

export function useDeleteOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('outlets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.outlets })
      qc.invalidateQueries({ queryKey: queryKeys.stores })
    },
  })
}
