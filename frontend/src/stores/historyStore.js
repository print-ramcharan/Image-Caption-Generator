import create from 'zustand'

const useHistoryStore = create((set) => ({
  localHistory: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('icg_history') || '[]') : [],
  selectedHistory: null,
  addLocal: (item) =>
    set((state) => {
      const next = [item, ...state.localHistory].slice(0, 50)
      if (typeof window !== 'undefined') localStorage.setItem('icg_history', JSON.stringify(next))
      return { localHistory: next }
    }),
  setFromServer: (arr) => set({ localHistory: arr.concat([]) }),
  setSelectedHistory: (item) => set({ selectedHistory: item })
}))

export default useHistoryStore
