import React, { useState, useRef, useEffect } from 'react'
import ImageUploader from '../components/ImageUploader'
import client from '../api/client'
import { uploadFileToCloudinary, saveHistoryToServer } from '../cloudinary'
import useHistoryStore from '../stores/historyStore'
import useAuthStore from '../stores/authStore'

export default function Home() {
  const [file, setFile] = useState(null)
  const [messages, setMessages] = useState([])
  const listRef = useRef(null)
  const uploaderRef = useRef(null)
  const [sending, setSending] = useState(false)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('selectedModel') || ''
    return ''
  })
  const { selectedHistory, setSelectedHistory } = useHistoryStore()

  // helper to add messages
  function pushMessage(msg) {
    setMessages((s) => [...s, msg])
  }

  // scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  // when user clicks attach, trigger file input inside ImageUploader
  function handleAttach() {
    uploaderRef.current?.clickFile()
  }

  // perform send: notify UI (user image) then trigger upload via uploader.send()
  async function handleSend() {
    if (!file) return
  // Get a signed-in app UID if available (from auth store); fallback to 'anon'
  const auth = useAuthStore.getState()
  const uid = (auth?.user && auth.user.sub) || 'anon'
  const token = auth?.token || null

    // Show the image immediately in chat
    const imageUrl = typeof file === 'string' ? file : URL.createObjectURL(file)
    pushMessage({ type: 'user', imageUrl })

    try {
      setSending(true)
      // 1) upload to Cloudinary (unsigned preset)
      const { url, raw } = await uploadFileToCloudinary(file, (progress) => {
        // optional: handle upload progress
      })
      const path = raw?.public_id || null

      // 2) call backend with the Cloudinary URL so it can download and run inference
      const res = await client.post('/api/generate_url', { image_url: url, model: selectedModel })
      const caption = res.data?.caption || '[no caption]'

      // 3) show bot caption
      pushMessage({ type: 'bot', text: caption })

      // 4) save history doc in Firestore for client-side history listing
      try {
        // store locally for immediate UI
        const { addLocal } = useHistoryStore.getState()
        addLocal({ caption, imageUrl: url, imagePath: path, model: selectedModel, timestamp: Date.now() })
        // also attempt to persist on the backend if we have a JWT
        if (token) {
          await saveHistoryToServer({ caption, imageUrl: url, imagePath: path, model: selectedModel, timestamp: Date.now() }, token)
        }
      } catch (e) {
        console.debug('Failed to save history', e)
      }
    } catch (e) {
      console.error(e)
      pushMessage({ type: 'bot', text: '[error]' })
    } finally {
      setSending(false)
      setFile(null)
    }
  }

  // auto-send when an attachment is selected
  useEffect(() => {
    if (file) {
      // small debounce to ensure file state is fully updated
      const t = setTimeout(() => {
        handleSend()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [file])

  // when a history item is selected in the sidebar, load it into the chat
  useEffect(() => {
    if (!selectedHistory) return
    // load a simple conversation showing the saved image (user) and the saved caption (bot)
    const msgs = []
    if (selectedHistory.imageUrl) {
      msgs.push({ type: 'user', imageUrl: selectedHistory.imageUrl })
    }
    msgs.push({ type: 'bot', text: selectedHistory.caption || '[no caption]' })
    setMessages(msgs)
  }, [selectedHistory])

  // load available models and pick default
  useEffect(() => {
    let mounted = true
    async function loadModels() {
      try {
        const res = await client.get('/api/models')
        if (!mounted) return
        const ms = res.data.models || []
        setModels(ms)
        if (!selectedModel && ms.length) {
          setSelectedModel(ms[0].id)
          try { localStorage.setItem('selectedModel', ms[0].id) } catch (e) {}
        }
      } catch (e) {
        console.debug('Could not fetch models list', e)
      }
    }
    loadModels()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try { if (selectedModel) localStorage.setItem('selectedModel', selectedModel) } catch (e) {}
  }, [selectedModel])

  return (
  <div className="flex flex-col h-full">
      <h1 className="text-2xl font-semibold mb-4">Image Caption Chat</h1>

      <div className="bg-white p-4 rounded shadow flex-1 flex flex-col min-h-0">
        {/* Main: responses (bot) - full width now that uploader controls moved to bottom bar */}
        <div className="w-full p-2 sm:p-4 flex flex-col h-full">
          <div className="flex-1 overflow-auto" ref={listRef}>
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${m.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} p-3 rounded-lg max-w-[90%] sm:max-w-[70%]`}> 
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="sent" className="max-w-full rounded mb-2 max-h-[60vh] sm:max-h-[40vh] object-contain" />
                    )}
                    {m.text && <div>{m.text}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* ChatGPT-style bottom input with model selector beside Attach */}
          <div className="mt-4 pt-3 border-t flex items-center gap-3 flex-wrap">
            <button onClick={handleAttach} className="px-3 py-2 bg-gray-100 rounded text-sm">Attach</button>

            {models.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="hidden sm:inline text-sm text-gray-600">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="border p-1 sm:p-2 rounded text-xs sm:text-sm"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.id} {m.type ? `(${m.type})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex-1 text-xs sm:text-sm text-gray-500">Attach an image; it will be sent automatically.</div>
            <button onClick={handleSend} disabled={!file || sending} className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded disabled:opacity-60">{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
      
  {/* keep the uploader component mounted (it only contains hidden input and logic) */}
      <div className="hidden">
        <ImageUploader
          ref={uploaderRef}
          file={file}
          setFile={setFile}
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onBeforeSend={() => { /* handled in Home when pushing user image */ }}
          onResult={(caption) => {
            pushMessage({ type: 'bot', text: caption })
          }}
        />
      </div>
      </div>
    </div>
  )
}
