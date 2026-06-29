import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { monthYear } from './transferLogic'

export function useCreateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      brandId: string
      outletId: string
      role: string
      joined: string
    }) => {
      const { data: st, error } = await supabase
        .from('staff')
        .insert({
          name: input.name,
          brand_id: input.brandId,
          outlet_id: input.outletId,
          role: input.role,
          joined: input.joined,
        })
        .select('id')
        .single()
      if (error) throw error
      const { error: hErr } = await supabase.from('staff_history').insert({
        staff_id: st.id,
        brand_id: input.brandId,
        outlet_id: input.outletId,
        from_label: monthYear(input.joined),
      })
      if (hErr) throw hErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useUpdateStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; role: string; joined: string }) => {
      const { error } = await supabase
        .from('staff')
        .update({ name: input.name, role: input.role, joined: input.joined })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error // staff_history cascades; follow_ups.staff_id set null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff })
      qc.invalidateQueries({ queryKey: queryKeys.visits })
    },
  })
}
