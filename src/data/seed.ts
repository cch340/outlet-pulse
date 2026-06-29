import type { Brand, Outlet, Store, Staff, FollowUp, Task } from './model'
import { DEFAULT_TASKS } from './model'

const mkTasks = (status: 'done' | 'pending', seed: number): Task[] =>
  DEFAULT_TASKS.map((label, i) => ({
    label,
    done: status === 'done' ? true : (seed + i) % 3 === 0,
  }))

export const seedBrands: Brand[] = [
  { id: 'b1', name: 'Skintific', color: '#0ea5e9', category: 'Skincare' },
  { id: 'b2', name: 'G2G', color: '#8b5cf6', category: 'Cosmetics' },
  { id: 'b3', name: 'Facerinna', color: '#ec4899', category: 'Beauty' },
]

export const seedOutlets: Outlet[] = [
  { id: 'o1', name: 'Gurney Plaza', location: 'Georgetown' },
  { id: 'o2', name: 'Queensbay Mall', location: 'Bayan Lepas' },
  { id: 'o3', name: 'Sunway Carnival', location: 'Seberang Jaya' },
]

export const seedStores: Store[] = [
  { brandId: 'b1', outletId: 'o1' },
  { brandId: 'b1', outletId: 'o2' },
  { brandId: 'b1', outletId: 'o3' },
  { brandId: 'b2', outletId: 'o1' },
  { brandId: 'b2', outletId: 'o2' },
  { brandId: 'b3', outletId: 'o2' },
  { brandId: 'b3', outletId: 'o3' },
]

export const seedStaff: Staff[] = [
  { id: 'st1', name: 'John Tan', brandId: 'b1', outletId: 'o1', role: 'Supervisor', joined: '2023-03-01', history: [{ brandId: 'b1', outletId: 'o1', from: 'Mar 2023' }] },
  { id: 'st2', name: 'Peter Lim', brandId: 'b2', outletId: 'o2', role: 'Promoter', joined: '2024-01-15', history: [{ brandId: 'b2', outletId: 'o2', from: 'Jan 2024' }] },
  { id: 'st3', name: 'Ana Rahman', brandId: 'b3', outletId: 'o3', role: 'Beauty Advisor', joined: '2023-08-10', history: [{ brandId: 'b3', outletId: 'o3', from: 'Aug 2023' }] },
  { id: 'st4', name: 'Kiriko Sato', brandId: 'b1', outletId: 'o2', role: 'Promoter', joined: '2024-06-20', history: [{ brandId: 'b1', outletId: 'o2', from: 'Jun 2024' }] },
  { id: 'st5', name: 'Mei Ling', brandId: 'b2', outletId: 'o1', role: 'Promoter', joined: '2022-11-05', history: [{ brandId: 'b2', outletId: 'o1', from: 'Nov 2022' }] },
  { id: 'st6', name: 'Raj Kumar', brandId: 'b3', outletId: 'o2', role: 'Supervisor', joined: '2023-02-14', history: [{ brandId: 'b3', outletId: 'o2', from: 'Feb 2023' }] },
  { id: 'st7', name: 'Siti Nurul', brandId: 'b1', outletId: 'o3', role: 'Beauty Advisor', joined: '2024-09-01', history: [{ brandId: 'b1', outletId: 'o3', from: 'Sep 2024' }] },
  { id: 'st8', name: 'Daniel Wong', brandId: 'b2', outletId: 'o2', role: 'Promoter', joined: '2024-03-12', history: [{ brandId: 'b2', outletId: 'o1', from: 'Mar 2024', to: 'Feb 2025' }, { brandId: 'b2', outletId: 'o2', from: 'Feb 2025' }] },
]

const fuRaw: [string, string, string, string, string, 'done' | 'pending'][] = [
  ['f1', '2026-01-12', 'st1', 'b1', 'o1', 'done'], ['f2', '2026-01-20', 'st2', 'b2', 'o2', 'done'],
  ['f3', '2026-02-03', 'st3', 'b3', 'o3', 'done'], ['f4', '2026-02-18', 'st4', 'b1', 'o2', 'done'],
  ['f5', '2026-03-05', 'st5', 'b2', 'o1', 'done'], ['f6', '2026-03-22', 'st6', 'b3', 'o2', 'done'],
  ['f7', '2026-04-09', 'st7', 'b1', 'o3', 'done'], ['f8', '2026-04-28', 'st8', 'b2', 'o2', 'pending'],
  ['f9', '2026-05-14', 'st1', 'b1', 'o1', 'done'], ['f10', '2026-05-30', 'st3', 'b3', 'o3', 'pending'],
  ['f11', '2026-06-10', 'st2', 'b2', 'o2', 'done'], ['f12', '2026-06-18', 'st4', 'b1', 'o2', 'pending'],
  ['f13', '2026-06-25', 'st1', 'b1', 'o1', 'pending'], ['f14', '2026-06-30', 'st6', 'b3', 'o2', 'pending'],
  ['f15', '2026-07-04', 'st7', 'b1', 'o3', 'pending'], ['f16', '2026-07-15', 'st5', 'b2', 'o1', 'pending'],
]

export const seedFollowups: FollowUp[] = fuRaw.map((r, i) => ({
  id: r[0],
  date: r[1],
  staffId: r[2],
  brandId: r[3],
  outletId: r[4],
  status: r[5],
  tasks: mkTasks(r[5], i),
}))
