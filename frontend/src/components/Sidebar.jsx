import React, { useEffect, useState } from 'react'
import useAuthStore from '../stores/authStore'
import useHistoryStore from '../stores/historyStore'
import client from '../api/client'

export default function Sidebar() {
  const { user, token, setAuth, logout, isAuthenticated } = useAuthStore()
  const { localHistory, setFromServer, setSelectedHistory } = useHistoryStore()
  const [open, setOpen] = useState(true)

  // default open state based on screen width (closed on small screens)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setOpen(window.innerWidth >= 768)
    const onResize = () => setOpen(window.innerWidth >= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // derive simple initials for avatar from user name or email
  const initials = (() => {
    try {
      if (user?.name) {
        const parts = user.name.split(' ').filter(Boolean)
        return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
      }
      if (user?.email) {
        const pre = user.email.split('@')[0]
        const parts = pre.split(/[._-]/).filter(Boolean)
        return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
      }
    } catch (e) {}
    return 'U'
  })()

  useEffect(() => {
    async function fetchHistory() {
      try {
        // attempt to fetch history; backend will return anon history if cookie present
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const res = await client.get('/api/history', { headers })
        setFromServer(res.data.history || [])
      } catch (err) {
        // ignore 401 for unauthenticated users
        if (err?.response?.status === 401) return
        console.error('fetch history', err)
      }
    }
    fetchHistory()
  }, [token])

  // Google sign-in will be triggered from the client-side script
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  
      script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: '239644021087-p9u38lshg973ld12s4a8c0fmgemh6mah.apps.googleusercontent.com',
      use_fedcm_for_prompt: true,  
      callback: async (resp) => {
          try {
            const r = await client.post('/api/auth/google', {
              token: resp.credential
            }, {
              headers: {
                'Content-Type': 'application/json',
              },
              withCredentials: true
            })
            setAuth(r.data.user, r.data.token)
          } catch (err) {
          console.error('auth', err)
          alert('Failed to sign in: ' + (err.response?.data?.detail || err.message))
        }
      },
      // ADD THESE OPTIONS to reduce CORS issues
      // use_fedcm_for_prompt: false,  // Disable FedCM (new Chrome feature causing issues)
    })
    
    // Render the button
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { 
        theme: 'outline', 
        size: 'large',
        width: 250,
      }
    )
  }
}, [])

  function onGoogleSignIn() {
    if (typeof window === 'undefined' || !window.google) {
      alert('Google Identity SDK not loaded')
      return
    }
    google.accounts.id.prompt()
  }

  function handleOpenHistory(item) {
    // set selected in store so Home can react
    setSelectedHistory(item)
    // open the main pane (helpful on small screens)
    setOpen(false)
  }

  return (
    <>
      {open ? (
        // On mobile we render the sidebar as a fixed overlay that sits above the main content.
        <>
          {/* backdrop - only on small screens */}
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
          <aside className={`fixed z-50 top-0 left-0 h-full w-4/5 max-w-sm border-r bg-white p-4 flex flex-col md:relative md:top-auto md:left-auto md:h-auto md:w-72`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">History</h2>
              <button onClick={() => setOpen(false)} className="text-sm text-gray-600">
                Close
              </button>
            </div>

          <div className="mb-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium"
                  title={user?.email}
                >
                  {initials}
                </div>
                <div>
                  <button onClick={async () => { logout(); }} className="mt-2 text-sm text-red-600">Sign out</button>
                </div>
              </div>
            ) : (
              <div>
                <div id="google-signin-button" className="mb-2"></div>
                <button onClick={onGoogleSignIn} className="px-3 py-1 bg-green-600 text-white rounded">
                  Sign in with Google
                </button>
                <div className="text-xs text-gray-500 mt-2">1 free generation without signing in</div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <h3 className="text-sm font-medium mb-2">Recent</h3>
            <div className="divide-y border rounded overflow-hidden">
              {localHistory.length === 0 && (
                <div className="p-3 text-sm text-gray-500">No history yet</div>
              )}
              {localHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleOpenHistory(h)}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="text-sm line-clamp-2 text-gray-800">{h.caption}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(h.timestamp).toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          </aside>
        </>
      ) : (
        <div className="fixed left-2 top-4 z-40 w-12 flex flex-col items-start border bg-white p-2 shadow md:static md:border-r md:shadow-none">
          <div className="w-full flex justify-start">
            <button onClick={() => setOpen(true)} className="px-2 py-1 bg-white border rounded shadow text-xs">
              ☰
            </button>
          </div>
        </div>
      )}
    </>
  )
}
