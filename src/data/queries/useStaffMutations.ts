import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { monthYear, planTransfer } from './transferLogic'

export function useTransferStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      staffId: string
      brandId: string
      outletId: string
      reason: string
      date: string
    }) => {
      const stamp = monthYear(input.date)

      // Close any currently-open history rows (to_label is null).
      const { data: open, error: openErr } = await supabase
        .from('staff_history')
        .select('id')
        .eq('staff_id', input.staffId)
        .is('to_label', null)
      if (openErr) throw openErr

      const { closeIds, toLabel } = planTransfer({ historyIdsToClose: open ?? [], toLabel: stamp })
      if (closeIds.length) {
        const { error: closeErr } = await supabase
          .from('staff_history')
          .update({ to_label: toLabel })
          .in('id', closeIds)
        if (closeErr) throw closeErr
      }

      // Move the staff member.
      const { error: moveErr } = await supabase
        .from('staff')
        .update({ brand_id: input.brandId, outlet_id: input.outletId })
        .eq('id', input.staffId)
      if (moveErr) throw moveErr

      // Open a new history row.
      const { error: insErr } = await supabase.from('staff_history').insert({
        staff_id: input.staffId,
        brand_id: input.brandId,
        outlet_id: input.outletId,
        from_label: stamp,
        reason: input.reason || null,
      })
      if (insErr) throw insErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  })
}
