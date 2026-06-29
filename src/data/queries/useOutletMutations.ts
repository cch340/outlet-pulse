import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateOutlet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; location: string }) => {
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
