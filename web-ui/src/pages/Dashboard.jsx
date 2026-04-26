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
      <div className="relative bg-red-950/30 border-2 border-red-500/50 rounded-xl p-6 text-red-300 overflow-hidden">
        <div className="absolute inset-0 bg-red-500/5 animate-pulse"></div>
        <div className="relative flex items-center gap-3">
          <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-bold font-mono">CONNECTION LOST</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center gap-3 text-cyan-400 font-mono">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <span>INITIALIZING SYSTEM...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-wider mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
          DASHBOARD
        </h1>
        <div className="h-1 w-32 bg-gradient-to-r from-cyan-400 to-transparent rounded-full"></div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          label="Server Status"
          value={status.status === 'running' ? 'ONLINE' : 'OFFLINE'}
          color={status.status === 'running' ? 'green' : 'red'}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatusCard
          label="Version"
          value={`v${status.version}`}
          color="cyan"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatusCard
          label="Active Providers"
          value={`${status.providers_count} CONNECTED`}
          color="purple"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          }
        />
      </div>

      {/* Server Info Panel */}
      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-purple-400 rounded-full"></div>
            <h2 className="text-xl font-bold text-white font-mono tracking-wider">SERVER INFORMATION</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem 
              label="UPTIME" 
              value={status.uptime}
              icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              }
            />
            <InfoItem 
              label="ENDPOINT" 
              value="http://localhost:7860"
              icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              }
              mono
            />
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-purple-500/30 rounded-xl p-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-purple-400 to-pink-400 rounded-full"></div>
            <h2 className="text-xl font-bold text-white font-mono tracking-wider">QUICK START</h2>
          </div>

          <div className="space-y-4">
            <QuickStartStep 
              number="01"
              text="Navigate to"
              link="Providers"
              linkHref="/providers"
              suffix="and configure your AI provider"
            />
            <QuickStartStep 
              number="02"
              text="Point your IDE to"
              code="http://localhost:7860/v1"
            />
            <QuickStartStep 
              number="03"
              text="Start using AI features in your development environment"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, value, color, icon }) {
  const colors = {
    green: {
      border: 'border-green-500/30',
      bg: 'from-green-950/50 to-green-900/30',
      text: 'text-green-400',
      glow: 'bg-green-500/20',
      pulse: 'bg-green-400'
    },
    red: {
      border: 'border-red-500/30',
      bg: 'from-red-950/50 to-red-900/30',
      text: 'text-red-400',
      glow: 'bg-red-500/20',
      pulse: 'bg-red-400'
    },
    cyan: {
      border: 'border-cyan-500/30',
      bg: 'from-cyan-950/50 to-cyan-900/30',
      text: 'text-cyan-400',
      glow: 'bg-cyan-500/20',
      pulse: 'bg-cyan-400'
    },
    purple: {
      border: 'border-purple-500/30',
      bg: 'from-purple-950/50 to-purple-900/30',
      text: 'text-purple-400',
      glow: 'bg-purple-500/20',
      pulse: 'bg-purple-400'
    },
  }

  const theme = colors[color]

  return (
    <div className={`relative bg-gradient-to-br ${theme.bg} backdrop-blur-xl border ${theme.border} rounded-xl p-5 overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 ${theme.glow} rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs uppercase tracking-wider font-mono ${theme.text} opacity-70`}>{label}</p>
          <div className={theme.text}>{icon}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 ${theme.pulse} rounded-full animate-pulse`}></div>
          <p className={`text-2xl font-bold ${theme.text} font-mono`}>{value}</p>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value, icon, mono }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-black/30 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
      <div className="text-cyan-400 mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-cyan-300/60 uppercase tracking-wider font-mono mb-1">{label}</p>
        <p className={`text-white ${mono ? 'font-mono text-sm' : 'text-base'}`}>{value}</p>
      </div>
    </div>
  )
}

function QuickStartStep({ number, text, link, linkHref, suffix, code }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-colors group">
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg flex items-center justify-center">
        <span className="text-purple-400 font-bold font-mono text-sm">{number}</span>
      </div>
      <div className="flex-1 pt-1">
        <p className="text-gray-300 text-sm">
          {text}{' '}
          {link && (
            <>
              <a href={linkHref} className="text-purple-400 hover:text-purple-300 font-semibold underline decoration-purple-400/30 hover:decoration-purple-300 transition-colors">
                {link}
              </a>
              {suffix && <span> {suffix}</span>}
            </>
          )}
          {code && (
            <code className="inline-block mt-2 px-3 py-1.5 bg-purple-950/50 border border-purple-500/30 rounded text-purple-300 font-mono text-xs">
              {code}
            </code>
          )}
        </p>
      </div>
    </div>
  )
}
