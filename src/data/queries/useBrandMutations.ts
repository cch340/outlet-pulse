import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string; category: string; sort: number }) => {
      const { error } = await supabase.from('brands').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: string; category: string }) => {
      const { id, ...fields } = input
      const { error } = await supabase.from('brands').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw error // FK restrict surfaces a clear message if staff/stores reference it
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brands })
      qc.invalidateQueries({ queryKey: queryKeys.stores })
    },
  })
}

export function useReorderBrands() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      // Persist new order by writing each row's index as its sort value.
      for (let i = 0; i < input.ids.length; i++) {
        const { error } = await supabase.from('brands').update({ sort: i }).eq('id', input.ids[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
  })
}

export function useSetBrandStores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletIds: string[] }) => {
      const { error: delErr } = await supabase.from('stores').delete().eq('brand_id', input.brandId)
      if (delErr) throw delErr
      if (input.outletIds.length) {
        const rows = input.outletIds.map((outlet_id) => ({ brand_id: input.brandId, outlet_id }))
        const { error: insErr } = await supabase.from('stores').insert(rows)
        if (insErr) throw insErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}

export function useLinkStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletId: string }) => {
      const { error } = await supabase
        .from('stores')
        .insert({ brand_id: input.brandId, outlet_id: input.outletId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}

export function useUnlinkStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { brandId: string; outletId: string }) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('brand_id', input.brandId)
        .eq('outlet_id', input.outletId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores }),
  })
}
