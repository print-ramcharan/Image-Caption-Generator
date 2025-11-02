import React from 'react'
import Home from './pages/Home'
import Sidebar from './components/Sidebar'

export default function App() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <Home />
      </main>
    </div>
  )
}
