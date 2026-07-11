import type { HistoryEntry } from '../model'

/** An update to the current (open) staff_history row so it reflects a corrected posting. */
export interface CurrentHistoryRowUpdate {
  id: string
  brandId: string
  outletId: string
}

/** What to persist when correcting a staff posting in place (no transfer entry). */
export interface PostingCorrectionPlan {
  brandId: string
  outletId: string
  /** The current posting's history row to rewrite, or null when the staff has no history. */
  currentHistoryRowUpdate: CurrentHistoryRowUpdate | null
}

/**
 * Plan a posting correction — a data fix, not a transfer. The staff row's
 * brand/outlet always move to the new pair. If the staff has history, the
 * CURRENT entry (the open one, `to === undefined`) also moves, since it
 * represents the present posting; past entries are left untouched so the
 * timeline of real transfers stays intact.
 */
export function planPostingCorrection(
  staff: { history: HistoryEntry[] },
  newBrandId: string,
  newOutletId: string,
): PostingCorrectionPlan {
  const current = staff.history.find((h) => h.to === undefined)
  return {
    brandId: newBrandId,
    outletId: newOutletId,
    currentHistoryRowUpdate: current
      ? { id: current.id, brandId: newBrandId, outletId: newOutletId }
      : null,
  }
}
