import create from 'zustand'

const useAuthStore = create((set) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('icg_token') : null
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('icg_user') || 'null') : null
  return {
    token,
    user,
    isAuthenticated: !!token,
    setAuth: (user, token) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('icg_token', token)
        localStorage.setItem('icg_user', JSON.stringify(user))
      }
      set({ user, token, isAuthenticated: true })
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('icg_token')
        localStorage.removeItem('icg_user')
      }
      set({ user: null, token: null, isAuthenticated: false })
    },
  }
})

export default useAuthStore
