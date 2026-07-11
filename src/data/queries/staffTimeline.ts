import type { HistoryEntry } from '../model'

/** One posting period in a staff member's history, ready to render in a timeline. */
export interface TimelineEntryVM {
  key: string
  brandName: string
  brandColor: string
  outletName: string
  fromLabel: string
  toLabel?: string
  /** Human period label: "Since Mar 2023" for the active posting, else "Mar 2023 – Feb 2025". */
  periodLabel: string
  reason?: string
  /** True for the still-open posting (no to_label). */
  isCurrent: boolean
  /** True for the oldest posting — the initial join. */
  isInitial: boolean
}

/**
 * Build a most-recent-first timeline from `Staff.history`.
 *
 * `history` arrives oldest→newest (see rowToStaff). Each entry is a posting at a
 * brand+outlet spanning `from`→`to` (month-year labels); a missing `to` is the
 * current posting. The oldest entry is the initial join (no transfer reason).
 * Brand/outlet names are resolved by the caller so this stays pure & testable.
 */
export function buildStaffTimeline(
  history: HistoryEntry[],
  resolve: (entry: HistoryEntry) => { brandName: string; brandColor: string; outletName: string },
): TimelineEntryVM[] {
  return history
    .map((e, i): TimelineEntryVM => {
      const { brandName, brandColor, outletName } = resolve(e)
      const isCurrent = e.to === undefined
      return {
        key: `${i}-${e.brandId}-${e.outletId}-${e.from}`,
        brandName,
        brandColor,
        outletName,
        fromLabel: e.from,
        toLabel: e.to,
        periodLabel: isCurrent ? `Since ${e.from}` : `${e.from} – ${e.to}`,
        reason: e.reason,
        isCurrent,
        isInitial: i === 0,
      }
    })
    .reverse()
}
