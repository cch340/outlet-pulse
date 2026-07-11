import { describe, it, expect } from 'vitest'
import {
  photoPath,
  canAddPhoto,
  targetDimensions,
  MAX_PHOTOS_PER_TASK,
  MAX_EDGE_PX,
} from './photoPaths'

describe('photoPath', () => {
  it('builds <ownerId>/<taskId>/<fileId>.jpg', () => {
    expect(photoPath('owner-1', 'task-2', 'file-3')).toBe('owner-1/task-2/file-3.jpg')
  })

  it('puts the owner id first (storage RLS scopes on foldername[1])', () => {
    expect(photoPath('uid', 't', 'f').split('/')[0]).toBe('uid')
  })
})

describe('canAddPhoto', () => {
  it('allows up to but not beyond the cap', () => {
    expect(canAddPhoto(0)).toBe(true)
    expect(canAddPhoto(MAX_PHOTOS_PER_TASK - 1)).toBe(true)
    expect(canAddPhoto(MAX_PHOTOS_PER_TASK)).toBe(false)
    expect(canAddPhoto(MAX_PHOTOS_PER_TASK + 1)).toBe(false)
  })
})

describe('targetDimensions', () => {
  it('scales a landscape image down by its width', () => {
    expect(targetDimensions(3200, 2400)).toEqual({ w: 1600, h: 1200 })
  })

  it('scales a portrait image down by its height', () => {
    expect(targetDimensions(2400, 3200)).toEqual({ w: 1200, h: 1600 })
  })

  it('passes a small image through unchanged', () => {
    expect(targetDimensions(800, 600)).toEqual({ w: 800, h: 600 })
  })

  it('does not upscale an image whose longest edge equals the cap', () => {
    expect(targetDimensions(MAX_EDGE_PX, 900)).toEqual({ w: MAX_EDGE_PX, h: 900 })
  })

  it('rounds fractional results to whole pixels', () => {
    // 1000x1601 -> scale 1600/1601, height clamps to 1600, width rounds.
    const { w, h } = targetDimensions(1000, 1601)
    expect(h).toBe(1600)
    expect(Number.isInteger(w)).toBe(true)
    expect(w).toBe(Math.round(1000 * (1600 / 1601)))
  })

  it('honours a custom maxEdge', () => {
    expect(targetDimensions(1000, 500, 100)).toEqual({ w: 100, h: 50 })
  })
})
