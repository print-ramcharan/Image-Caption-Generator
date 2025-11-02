import client from './api/client'

// Cloudinary direct upload helper (unsigned upload preset)
export async function uploadFileToCloudinary(file, onProgress) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your env.')
  }
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.({ loaded: e.loaded, total: e.total })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText)
          resolve({ url: res.secure_url, raw: res })
        } catch (err) {
          reject(err)
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status} ${xhr.statusText} ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error uploading to Cloudinary'))
    xhr.send(fd)
  })
}

// Save history to backend /api/history (requires JWT token). Returns server response or null.
export async function saveHistoryToServer(item, token) {
  if (!token) return null
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const res = await client.post('/api/history', item, { headers })
    return res.data
  } catch (e) {
    console.debug('Failed to save history to server', e)
    return null
  }
}

export default {
  uploadFileToCloudinary,
  saveHistoryToServer,
}
