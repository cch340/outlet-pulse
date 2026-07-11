export const queryKeys = {
  brands: ['brands'] as const,
  outlets: ['outlets'] as const,
  stores: ['stores'] as const,
  staff: ['staff'] as const,
  visits: ['visits'] as const,
  visitsPage: (params: unknown) => ['visits', 'page', params] as const,
  visitStatusCounts: (params: unknown) => ['visits', 'counts', params] as const,
  visit: (id: string | null) => ['visits', 'one', id] as const,
  // Under the 'visits' namespace so visit mutations (which invalidate
  // ['visits']) also refresh a staff member's performance stats.
  staffVisits: (staffId: string | null) => ['visits', 'staff', staffId] as const,
  dashboardSummary: (params: unknown) => ['visits', 'dashboard', params] as const,
  visitsMissingLabel: (params: unknown) => ['visits', 'missing', params] as const,
  latestFailedTasks: (month: string) => ['visits', 'latestFailed', month] as const,
  taskPhotos: (visitId: string | null) => ['taskPhotos', visitId] as const,
  // Kept under the 'taskPhotos' prefix so photo upload/delete mutations, which
  // invalidate ['taskPhotos'], also refresh the per-visit count badges.
  photoCounts: (taskIds: string[]) => ['taskPhotos', 'counts', taskIds] as const,
  photoUrl: (path: string) => ['photoUrl', path] as const,
  taskTemplates: ['taskTemplates'] as const,
  recurringSchedules: ['recurringSchedules'] as const,
}
