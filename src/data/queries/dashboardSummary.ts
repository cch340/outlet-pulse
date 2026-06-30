export interface DashboardKpis {
  total: number
  done: number
  pending: number
  overdue: number
}
export interface TrendPoint {
  month: string // 'YYYY-MM'
  done: number
  total: number
}
export interface BrandStat {
  brandId: string
  done: number
  total: number
}
export interface AttentionItem {
  id: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
}
export interface DashboardSummary {
  kpisMonth: DashboardKpis
  kpisYear: DashboardKpis
  trend: TrendPoint[]
  brandBreakdown: BrandStat[]
  overdue: AttentionItem[]
  upcoming: AttentionItem[]
  overdueTotal: number
  upcomingTotal: number
}
export interface MissingLabelVisit {
  id: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
}

const ZERO_KPIS: DashboardKpis = { total: 0, done: 0, pending: 0, overdue: 0 }

export const EMPTY_SUMMARY: DashboardSummary = {
  kpisMonth: ZERO_KPIS,
  kpisYear: ZERO_KPIS,
  trend: [],
  brandBreakdown: [],
  overdue: [],
  upcoming: [],
  overdueTotal: 0,
  upcomingTotal: 0,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

const num = (x: unknown): number => Number(x ?? 0)

function kpis(raw: Raw): DashboardKpis {
  const r = raw ?? {}
  return { total: num(r.total), done: num(r.done), pending: num(r.pending), overdue: num(r.overdue) }
}

function attentionList(raw: Raw): AttentionItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Raw) => ({
    id: x.id,
    date: x.date,
    brandName: x.brand_name,
    outletName: x.outlet_name,
    staffName: x.staff_name ?? null,
  }))
}

export function mapDashboardSummary(raw: Raw): DashboardSummary {
  const r = raw ?? {}
  return {
    kpisMonth: kpis(r.kpis_month),
    kpisYear: kpis(r.kpis_year),
    trend: Array.isArray(r.trend)
      ? r.trend.map((t: Raw) => ({ month: t.month, done: num(t.done), total: num(t.total) }))
      : [],
    brandBreakdown: Array.isArray(r.brand_breakdown)
      ? r.brand_breakdown.map((b: Raw) => ({ brandId: b.brand_id, done: num(b.done), total: num(b.total) }))
      : [],
    overdue: attentionList(r.overdue),
    upcoming: attentionList(r.upcoming),
    overdueTotal: num(r.overdue_total),
    upcomingTotal: num(r.upcoming_total),
  }
}

export function mapMissingLabelVisit(raw: Raw): MissingLabelVisit {
  return {
    id: raw.id,
    date: raw.date,
    brandName: raw.brand_name,
    outletName: raw.outlet_name,
    staffName: raw.staff_name ?? null,
  }
}

export interface FailedTask {
  label: string
  remark: string
}
export interface LatestFailedVisit {
  brandId: string
  outletId: string
  visitId: string
  date: string
  brandName: string
  outletName: string
  staffName: string | null
  status: 'attention' | 'done'
  failed: FailedTask[]
}

export function mapLatestFailedTasks(raw: Raw): LatestFailedVisit[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Raw) => ({
    brandId: x.brand_id,
    outletId: x.outlet_id,
    visitId: x.id,
    date: x.date,
    brandName: x.brand_name,
    outletName: x.outlet_name,
    staffName: x.staff_name ?? null,
    status: x.base_status,
    failed: Array.isArray(x.failed)
      ? x.failed.map((t: Raw) => ({ label: t.label, remark: t.remark ?? '' }))
      : [],
  }))
}
