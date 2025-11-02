import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import client from '../api/client'
import useAuthStore from '../stores/authStore'
import useHistoryStore from '../stores/historyStore'

// Controlled ImageUploader: parent can pass `file` and `setFile`. Parent receives
// lifecycle callbacks: onBeforeSend(imageUrl) and onResult(caption).
const ImageUploader = forwardRef(function ImageUploader({ file, setFile, onBeforeSend, onResult, models = [], selectedModel, setSelectedModel }, ref) {
  const [loading, setLoading] = useState(false)
  const { token, isAuthenticated } = useAuthStore()
  const { addLocal } = useHistoryStore()

  const freeUsed = typeof window !== 'undefined' && localStorage.getItem('freeUsed') === '1'
  const fileInputRef = useRef(null)

  async function onSubmit(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!file) return
    if (!isAuthenticated && freeUsed) {
      alert('Please sign in with Google to continue generating captions.')
      return
    }

    // create preview URL and notify parent so chat UI can show the image immediately
    const imageUrl = typeof file === 'string' ? file : URL.createObjectURL(file)
    onBeforeSend?.(imageUrl)

    setLoading(true)
    try {
  const fd = new FormData()
  fd.append('file', file)
  if (selectedModel) fd.append('model', selectedModel)
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await client.post('/api/generate', fd, { headers })
      const caption = res.data.caption
      // notify parent and local history
      onResult?.(caption)
      addLocal({ caption, timestamp: Date.now() })
      if (!isAuthenticated) localStorage.setItem('freeUsed', '1')
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to generate caption')
      onResult?.('[error]')
    } finally {
      setLoading(false)
    }
  }

  // expose send() to parent via ref
  useImperativeHandle(ref, () => ({
    send: () => onSubmit(),
    clickFile: () => fileInputRef.current?.click(),
  }))
  return (
    <div className="">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      {/* Note: model selector and send button are rendered by parent (chat-style input). */}
    </div>
  )
})

export default ImageUploader
