import { supabase } from './supabaseClient'

export const ANNOUNCEMENT_IMAGES_BUCKET = 'announcement-images'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const sanitizeFilename = (name) =>
  String(name || 'image')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80) || 'image'

export function validateAnnouncementImageFile(file) {
  if (!file) return 'Please choose an image file.'
  if (!ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Use JPG, PNG, WebP, or GIF only.'
  }
  if (file.size > MAX_BYTES) return 'Image must be 5 MB or smaller.'
  return null
}

export async function uploadAnnouncementImage(file) {
  const validationError = validateAnnouncementImageFile(file)
  if (validationError) throw new Error(validationError)

  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
  const path = `admin/${Date.now()}_${sanitizeFilename(file.name)}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(ANNOUNCEMENT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image.')
  }

  const { data } = supabase.storage.from(ANNOUNCEMENT_IMAGES_BUCKET).getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Upload succeeded but public URL was not returned.')
  return { path, publicUrl }
}

export function parseNotificationImageUrl(data) {
  if (!data || typeof data !== 'object') return null
  const url = String(data.image_url || data.imageUrl || '').trim()
  return url || null
}
