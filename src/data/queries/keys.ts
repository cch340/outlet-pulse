export const queryKeys = {
  brands: ['brands'] as const,
  outlets: ['outlets'] as const,
  stores: ['stores'] as const,
  staff: ['staff'] as const,
  visits: ['visits'] as const,
  visitsPage: (params: unknown) => ['visits', 'page', params] as const,
  visitStatusCounts: (params: unknown) => ['visits', 'counts', params] as const,
  taskTemplates: ['taskTemplates'] as const,
}
