import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Brand, Outlet, Staff, Store, TaskTemplate } from '../model'
import { rowToStaff, rowToStore, rowToTaskTemplate } from './mappers'
import { queryKeys } from './keys'

export interface DataSnapshot {
  brands: Brand[]
  outlets: Outlet[]
  stores: Store[]
  staff: Staff[]
  taskTemplates: TaskTemplate[]
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

async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase.from('task_templates').select('*').order('sort')
  if (error) throw error
  return data.map(rowToTaskTemplate)
}

export function useData(): { data: DataSnapshot; isLoading: boolean; isError: boolean } {
  const brands = useQuery({ queryKey: queryKeys.brands, queryFn: fetchBrands })
  const outlets = useQuery({ queryKey: queryKeys.outlets, queryFn: fetchOutlets })
  const stores = useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores })
  const staff = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaff })
  const taskTemplates = useQuery({ queryKey: queryKeys.taskTemplates, queryFn: fetchTaskTemplates })

  const queries = [brands, outlets, stores, staff, taskTemplates]
  return {
    data: {
      brands: brands.data ?? [],
      outlets: outlets.data ?? [],
      stores: stores.data ?? [],
      staff: staff.data ?? [],
      taskTemplates: taskTemplates.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  }
}
