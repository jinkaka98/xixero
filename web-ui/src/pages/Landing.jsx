import { useState, useEffect } from 'react'

const GITHUB_REPO = 'jinkaka98/xixero'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

export default function Landing() {
  const [release, setRelease] = useState(null)
  const [loadingRelease, setLoadingRelease] = useState(true)
  const [activeTab, setActiveTab] = useState('download')

  useEffect(() => {
    fetch(GITHUB_API)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setRelease(data); setLoadingRelease(false) })
      .catch(() => setLoadingRelease(false))
  }, [])

  const getAssetUrl = (os) => {
    if (!release?.assets) return null
    const patterns = {
      windows: /windows.*amd64|xixero.*\.exe/i,
      linux: /linux.*amd64/i,
      mac_intel: /darwin.*amd64/i,
      mac_arm: /darwin.*arm64/i,
    }
    const asset = release.assets.find(a => patterns[os]?.test(a.name))
    return asset?.browser_download_url
  }

  const platforms = [
    { id: 'windows', label: 'Windows', arch: 'x64', icon: '⊞', url: getAssetUrl('windows') },
    { id: 'linux', label: 'Linux', arch: 'x64', icon: '⊕', url: getAssetUrl('linux') },
    { id: 'mac_intel', label: 'macOS', arch: 'Intel', icon: '⌘', url: getAssetUrl('mac_intel') },
    { id: 'mac_arm', label: 'macOS', arch: 'Apple Silicon', icon: '⌘', url: getAssetUrl('mac_arm') },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 opacity-15 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(to right, #ff6b00 1px, transparent 1px), linear-gradient(to bottom, #ff6b00 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          animation: 'gridMove 25s linear infinite'
        }}></div>
      </div>
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[200px]"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[200px]"></div>

      {/* Nav */}
      <nav className="relative z-20 border-b border-orange-500/20 backdrop-blur-xl bg-gray-950/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 tracking-wider" style={{ fontFamily: 'Orbitron, monospace' }}>
            XIXERO
          </h1>
          <div className="flex items-center gap-6">
            {['download', 'docs', 'changelog'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-mono uppercase tracking-wider transition-colors ${
                  activeTab === tab ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-white transition-colors font-mono"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Hero */}
        <section className="py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full mb-8">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-mono text-orange-300">
              {release ? `v${release.tag_name?.replace('v', '')} AVAILABLE` : 'LOADING...'}
            </span>
          </div>

          <h2 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 tracking-wider mb-6 leading-tight" style={{ fontFamily: 'Orbitron, monospace' }}>
            LOCAL AI<br />GATEWAY
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
            Route AI requests from your IDE through a single local endpoint.
            Multiple providers, one API.
          </p>
          <p className="text-sm text-gray-600 font-mono mb-12">
            OpenAI-compatible proxy &middot; Multi-provider routing &middot; License-managed
          </p>

          <div className="flex items-center justify-center gap-4">
            <a
              href="#download"
              onClick={() => setActiveTab('download')}
              className="px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_40px_rgba(251,146,60,0.3)] hover:shadow-[0_0_60px_rgba(251,146,60,0.5)] font-mono uppercase tracking-wider"
            >
              Download
            </a>
            <a
              href="#docs"
              onClick={() => setActiveTab('docs')}
              className="px-8 py-4 border-2 border-orange-500/30 hover:border-orange-500/60 text-orange-400 font-bold rounded-xl transition-all font-mono uppercase tracking-wider hover:bg-orange-500/10"
            >
              Documentation
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'MULTI-PROVIDER', desc: 'Connect OpenAI, enowX, Trae, and more. Route requests to any provider from a single endpoint.', icon: '⚡' },
            { title: 'IDE COMPATIBLE', desc: 'Works with VS Code, Cursor, Windsurf, and any tool that supports OpenAI API format.', icon: '⌨' },
            { title: 'LICENSE MANAGED', desc: 'Secure license activation with offline caching. Admin controls who gets access.', icon: '🔐' },
          ].map((f, i) => (
            <div key={i} className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-xl border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/40 transition-all group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-colors"></div>
              <div className="relative z-10">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-white font-mono tracking-wider mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Tab Content */}
        <section id="download" className={`py-16 ${activeTab !== 'download' ? 'hidden' : ''}`}>
          <SectionTitle title="DOWNLOAD" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {platforms.map(p => (
              <div key={p.id} className="relative bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-orange-500/20 rounded-xl p-6 text-center hover:border-orange-500/40 transition-all group">
                <div className="text-4xl mb-3 opacity-60 group-hover:opacity-100 transition-opacity">{p.icon}</div>
                <h4 className="text-white font-mono font-bold mb-1">{p.label}</h4>
                <p className="text-xs text-gray-500 font-mono mb-4">{p.arch}</p>
                {loadingRelease ? (
                  <div className="w-5 h-5 mx-auto border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></div>
                ) : p.url ? (
                  <a
                    href={p.url}
                    className="inline-block px-5 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-sm font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(251,146,60,0.2)]"
                  >
                    DOWNLOAD
                  </a>
                ) : (
                  <span className="text-xs text-gray-600 font-mono">Not available</span>
                )}
              </div>
            ))}
          </div>
          {release && (
            <p className="text-center text-xs text-gray-600 font-mono mt-6">
              Latest: {release.tag_name} &middot; {new Date(release.published_at).toLocaleDateString()}
            </p>
          )}
        </section>

        <section id="docs" className={`py-16 ${activeTab !== 'docs' ? 'hidden' : ''}`}>
          <SectionTitle title="DOCUMENTATION" />
          <div className="mt-8 space-y-6">
            <DocSection title="1. INSTALL" content={`
# Windows (PowerShell)
irm https://jinkaka98.github.io/xixero/install.ps1 | iex

# Or download binary manually from the Download tab
# Place xixero.exe in a folder and add to PATH`} />
            <DocSection title="2. ACTIVATE LICENSE" content={`
# Get your license key from the admin
xixero activate XIXERO-XXXXX-XXXXX-XXXXX`} />
            <DocSection title="3. START GATEWAY" content={`
# Start the AI proxy server
xixero start

# Server runs on http://localhost:7860
# API endpoint: http://localhost:7860/v1`} />
            <DocSection title="4. CONFIGURE IDE" content={`
# In your IDE settings, set the API endpoint to:
#   Base URL: http://localhost:7860/v1
#   API Key:  (shown in terminal when you run xixero start)

# Works with:
#   - VS Code + Continue / Copilot
#   - Cursor
#   - Windsurf
#   - Any OpenAI-compatible client`} />
            <DocSection title="5. MANAGE PROVIDERS" content={`
# Open the Web UI dashboard
# Navigate to http://localhost:7860 in your browser
# Or use the dashboard at https://jinkaka98.github.io/xixero

# Add providers: OpenAI, enowX, Trae, etc.
# Configure routing rules for model mapping`} />
          </div>
        </section>

        <section id="changelog" className={`py-16 ${activeTab !== 'changelog' ? 'hidden' : ''}`}>
          <SectionTitle title="CHANGELOG" />
          <div className="mt-8">
            {release ? (
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-orange-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-md text-orange-400 font-mono text-sm font-bold">{release.tag_name}</span>
                  <span className="text-xs text-gray-500 font-mono">{new Date(release.published_at).toLocaleDateString()}</span>
                </div>
                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {release.body || 'No release notes available.'}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 font-mono py-12">
                {loadingRelease ? 'Loading changelog...' : 'No releases found.'}
              </div>
            )}
            <div className="text-center mt-6">
              <a
                href={`https://github.com/${GITHUB_REPO}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-400 hover:text-orange-300 font-mono"
              >
                View all releases on GitHub →
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-orange-500/20 text-center">
          <p className="text-xs text-gray-600 font-mono">
            XIXERO &middot; Local AI Gateway &middot; <a href={`https://github.com/${GITHUB_REPO}`} className="text-orange-400/60 hover:text-orange-400">GitHub</a>
          </p>
        </footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ title }) {
  return (
    <div>
      <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 tracking-wider mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
        {title}
      </h2>
      <div className="h-1 w-24 bg-gradient-to-r from-orange-400 to-transparent rounded-full"></div>
    </div>
  )
}

function DocSection({ title, content }) {
  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-orange-500/20 rounded-xl overflow-hidden">
      <div className="px-6 py-3 border-b border-orange-500/20 bg-orange-500/5">
        <h3 className="text-sm font-bold text-orange-400 font-mono tracking-wider">{title}</h3>
      </div>
      <pre className="px-6 py-4 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{content.trim()}</pre>
    </div>
  )
}
