import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.getStatus()
        setStatus(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }

    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
        Server unreachable: {error}
      </div>
    )
  }

  if (!status) {
    return <div className="text-gray-400">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          label="Server"
          value={status.status === 'running' ? 'Online' : 'Offline'}
          color={status.status === 'running' ? 'green' : 'red'}
        />
        <StatusCard label="Version" value={`v${status.version}`} color="blue" />
        <StatusCard label="Providers" value={`${status.providers_count} active`} color="purple" />
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Server Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Uptime</span>
            <p className="text-white">{status.uptime}</p>
          </div>
          <div>
            <span className="text-gray-400">Endpoint</span>
            <p className="text-white font-mono">http://localhost:7860</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
        <div className="space-y-3 text-sm text-gray-300">
          <p>1. Go to <span className="text-blue-400 cursor-pointer" onClick={() => window.location.href = '/providers'}>Providers</span> and add your AI provider</p>
          <p>2. Configure your IDE to use <code className="bg-gray-700 px-2 py-1 rounded text-blue-300">http://localhost:7860/v1</code></p>
          <p>3. Start using AI features in your IDE</p>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, value, color }) {
  const colors = {
    green: 'bg-green-900/30 border-green-700 text-green-400',
    red: 'bg-red-900/30 border-red-700 text-red-400',
    blue: 'bg-blue-900/30 border-blue-700 text-blue-400',
    purple: 'bg-purple-900/30 border-purple-700 text-purple-400',
  }

  return (
    <div className={`border rounded-lg p-4 ${colors[color]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
