import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import { rowToTaskPhoto, type TaskPhotoRow } from './mappers'
import { photoPath } from '../photoPaths'
import { resizeImageToJpeg } from '../imageResize'
import { chunk } from '../listFilter'
import type { TaskPhoto, Visit } from '../model'

const BUCKET = 'task-photos'
// Keep `.in(task_id, ...)` lists short enough to stay under URL-length limits.
const IN_CHUNK = 500
const SIGNED_URL_TTL_SEC = 3600

/**
 * Fetch every task_photos row for the given task ids in one query, grouped into
 * a map taskId → TaskPhoto[] (ordered oldest-first). Only runs while the drawer
 * is open (visitId set) and there is at least one task id to look up.
 */
export function useTaskPhotos(visitId: string | null, taskIds: string[]) {
  const enabled = visitId != null && taskIds.length > 0
  return useQuery({
    queryKey: queryKeys.taskPhotos(visitId),
    enabled,
    queryFn: async (): Promise<Map<string, TaskPhoto[]>> => {
      const { data, error } = await supabase
        .from('task_photos')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true })
      if (error) throw error
      const byTask = new Map<string, TaskPhoto[]>()
      for (const row of (data as TaskPhotoRow[]) ?? []) {
        const photo = rowToTaskPhoto(row)
        const list = byTask.get(photo.taskId)
        if (list) list.push(photo)
        else byTask.set(photo.taskId, [photo])
      }
      return byTask
    },
  })
}

/**
 * Build a task-id → visit-id lookup from a set of visits (only persisted tasks,
 * i.e. those with an `id`, can carry photos).
 */
export function visitTaskIdMap(visits: Visit[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const v of visits) {
    for (const t of v.tasks) {
      if (t.id) map.set(t.id, v.id)
    }
  }
  return map
}

/**
 * Count photos per visit for the given task→visit mapping. Runs one chunked
 * `select task_id from task_photos in (...)` query and folds the rows back to
 * visit ids. Shared by the badge hook and the CSV export path.
 */
export async function fetchPhotoCounts(taskIdToVisitId: Map<string, string>): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const taskIds = [...taskIdToVisitId.keys()]
  if (taskIds.length === 0) return counts
  for (const ids of chunk(taskIds, IN_CHUNK)) {
    const { data, error } = await supabase.from('task_photos').select('task_id').in('task_id', ids)
    if (error) throw error
    for (const row of (data as { task_id: string }[]) ?? []) {
      const visitId = taskIdToVisitId.get(row.task_id)
      if (visitId == null) continue
      counts.set(visitId, (counts.get(visitId) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Photo counts for a list of visits, keyed visitId → count. Enabled only when
 * the visits carry at least one persisted task id. Shares the ['taskPhotos']
 * key prefix so photo upload/delete invalidations refresh the counts.
 */
export function usePhotoCountsForVisits(visits: Visit[]): Map<string, number> {
  const map = visitTaskIdMap(visits)
  const taskIds = [...map.keys()]
  const query = useQuery({
    queryKey: queryKeys.photoCounts(taskIds),
    enabled: taskIds.length > 0,
    queryFn: () => fetchPhotoCounts(map),
  })
  return query.data ?? EMPTY_COUNTS
}

const EMPTY_COUNTS: Map<string, number> = new Map()

/** A short-lived signed URL for a private photo object. */
export function useSignedPhotoUrl(path: string) {
  return useQuery({
    queryKey: queryKeys.photoUrl(path),
    // Signed URLs live an hour; refetch a little before expiry.
    staleTime: 45 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/** Fetch the storage paths of every photo attached to the given task ids. */
async function photoPathsForTasks(taskIds: string[]): Promise<string[]> {
  if (!taskIds.length) return []
  const { data, error } = await supabase
    .from('task_photos')
    .select('path')
    .in('task_id', taskIds)
  if (error) throw error
  return ((data as { path: string }[]) ?? []).map((r) => r.path)
}

/** Best-effort removal of storage objects; never throws (orphans are tolerable). */
async function removeObjectsQuietly(paths: string[]): Promise<void> {
  if (!paths.length) return
  try {
    await supabase.storage.from(BUCKET).remove(paths)
  } catch (e) {
    // Orphaned storage objects are an acceptable worst case; don't block callers.
    console.warn('task-photos: storage cleanup failed', e)
  }
}

export { photoPathsForTasks, removeObjectsQuietly }

export function useUploadTaskPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; file: File }) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const uid = userData.user?.id
      if (!uid) throw new Error('Not signed in.')

      const blob = await resizeImageToJpeg(input.file)
      const path = photoPath(uid, input.taskId, crypto.randomUUID())

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const { error: rowErr } = await supabase
        .from('task_photos')
        .insert({ task_id: input.taskId, path })
      if (rowErr) {
        // Row insert failed after the object landed — undo the upload so we
        // don't leave an orphan the user can never reference.
        await removeObjectsQuietly([path])
        throw rowErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskPhotos'] }),
  })
}

export function useDeleteTaskPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { photo: TaskPhoto }) => {
      // Remove the object first (tolerate a missing object), then the row.
      await removeObjectsQuietly([input.photo.path])
      const { error } = await supabase.from('task_photos').delete().eq('id', input.photo.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskPhotos'] }),
  })
}
