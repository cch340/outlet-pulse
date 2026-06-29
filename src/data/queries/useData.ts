import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Brand, FollowUp, Outlet, Staff, Store } from '../model'
import { rowToFollowUp, rowToStaff, rowToStore } from './mappers'
import { queryKeys } from './keys'

export interface DataSnapshot {
  brands: Brand[]
  outlets: Outlet[]
  stores: Store[]
  staff: Staff[]
  followups: FollowUp[]
}

async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error) throw error
  return data as Brand[]
}

async function fetchOutlets(): Promise<Outlet[]> {
  const { data, error } = await supabase.from('outlets').select('*').order('name')
  if (error) throw error
  return data as Outlet[]
}

async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('brand_id, outlet_id')
  if (error) throw error
  return data.map(rowToStore)
}

async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*, staff_history(*)')
    .order('name')
  if (error) throw error
  return data.map(rowToStaff)
}

async function fetchFollowups(): Promise<FollowUp[]> {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*, follow_up_tasks(*)')
    .order('date')
  if (error) throw error
  return data.map(rowToFollowUp)
}

export function useData(): { data: DataSnapshot; isLoading: boolean; isError: boolean } {
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: fetchBrands })
  const outlets = useQuery({ queryKey: queryKeys.outlets, queryFn: fetchOutlets })
  const stores = useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores })
  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff })
  const followups = useQuery({ queryKey: queryKeys.followups, queryFn: fetchFollowups })

  const queries = [brands, outlets, stores, staff, followups]
  return {
    data: {
      brands: brands.data ?? [],
      outlets: outlets.data ?? [],
      stores: stores.data ?? [],
      staff: staff.data ?? [],
      followups: followups.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  }
}
