import { useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'
import { useStore } from '../data/store'
import { useDialogA11y } from './useDialogA11y'
import {
  useSignedPhotoUrl,
  useUploadTaskPhoto,
  useDeleteTaskPhoto,
} from '../data/queries/useTaskPhotos'
import { canAddPhoto } from '../data/photoPaths'
import type { TaskPhoto } from '../data/model'

const TILE = 46

const tileBase: CSSProperties = {
  width: TILE,
  height: TILE,
  borderRadius: 7,
  flexShrink: 0,
  overflow: 'hidden',
  padding: 0,
  cursor: 'pointer',
}

/** A single square thumbnail backed by a short-lived signed URL. */
function TaskPhotoThumb({ photo, onOpen }: { photo: TaskPhoto; onOpen: () => void }) {
  const { data: url } = useSignedPhotoUrl(photo.path)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View photo"
      style={{
        ...tileBase,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ display: 'block', width: '100%', height: '100%', background: 'var(--surface2)' }} />
      )}
    </button>
  )
}

/** Thumbnails + an add-photo tile for one task. */
export function TaskPhotoRow({
  taskId,
  label,
  photos,
  onOpenPhoto,
}: {
  taskId: string
  label: string
  photos: TaskPhoto[]
  onOpenPhoto: (photo: TaskPhoto) => void
}) {
  const toast = useToast()
  const upload = useUploadTaskPhoto()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    setUploading(true)
    upload.mutate(
      { taskId, file },
      {
        onSuccess: () => setUploading(false),
        onError: (err) => {
          setUploading(false)
          toast.error("Couldn't add photo: " + err.message)
        },
      },
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {photos.map((p) => (
        <TaskPhotoThumb key={p.id} photo={p} onOpen={() => onOpenPhoto(p)} />
      ))}
      {canAddPhoto(photos.length) && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={`Add photo to ${label}`}
            title="Add photo"
            style={{
              ...tileBase,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--border)',
              background: 'transparent',
              color: 'var(--dim)',
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <Icon name={uploading ? 'hourglass_empty' : 'add_a_photo'} size={20} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            style={{ display: 'none' }}
          />
        </>
      )}
    </div>
  )
}

/** Full-screen viewer for a single photo, with a destructive delete action. */
export function PhotoLightbox({ photo, onClose }: { photo: TaskPhoto; onClose: () => void }) {
  const { state } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const del = useDeleteTaskPhoto()
  const { data: url } = useSignedPhotoUrl(photo.path)
  const ovPos = state.isMobile ? 'absolute' : 'fixed'
  const { dialogProps } = useDialogA11y({ onClose, label: 'Photo' })

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete photo',
      message: 'This photo will be permanently removed from the task.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    del.mutate(
      { photo },
      {
        onSuccess: () => {
          onClose()
          toast.success('Photo deleted.')
        },
        onError: (e) => toast.error("Couldn't delete photo: " + e.message),
      },
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: ovPos,
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 20,
        animation: 'backdrop var(--motion-dur) var(--motion-ease)',
      }}
    >
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: '92%',
          maxHeight: '92%',
        }}
      >
        {url ? (
          <img
            src={url}
            alt="Task photo"
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 10,
              animation: 'pop var(--motion-dur) var(--motion-ease)',
            }}
          />
        ) : (
          <div
            style={{
              width: 240,
              height: 180,
              borderRadius: 10,
              background: 'var(--surface2)',
            }}
          />
        )}
        <button
          type="button"
          onClick={onDelete}
          style={{
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            borderRadius: 9,
            padding: '10px 18px',
            fontFamily: "'IBM Plex Sans'",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Icon name="delete" size={17} />
          Delete photo
        </button>
      </div>
    </div>
  )
}
