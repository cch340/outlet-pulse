export const monthYear = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export const planTransfer = (input: {
  historyIdsToClose: { id: string }[]
  toLabel: string
}): { closeIds: string[]; toLabel: string } => ({
  closeIds: input.historyIdsToClose.map((h) => h.id),
  toLabel: input.toLabel,
})
