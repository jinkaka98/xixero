import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout({ onLogout }) {
  const navItems = [
    { 
      to: '/admin', 
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
      )
    },
    { 
      to: '/admin/licenses', 
      label: 'Licenses',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, #ff6b00 1px, transparent 1px),
            linear-gradient(to bottom, #ff6b00 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-gray-900/80 to-gray-950/80 backdrop-blur-xl border-r border-orange-500/30 flex flex-col relative z-10">
        {/* Logo section */}
        <div className="p-6 border-b border-orange-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 tracking-wider mb-1" style={{ fontFamily: 'Orbitron, monospace' }}>
              XIXERO
            </h1>
            <p className="text-xs text-orange-300/60 uppercase tracking-[0.2em] font-mono">Admin Panel</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-red-400/80 font-mono">RESTRICTED</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-300 relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600/20 to-red-600/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-400 hover:text-orange-300 hover:bg-orange-950/30 border border-transparent hover:border-orange-500/20'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 animate-pulse"></div>
                  )}
                  <div className="relative z-10 flex items-center gap-3 w-full">
                    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                      {item.icon}
                    </div>
                    <span className="font-mono tracking-wide">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System Status */}
        <div className="p-4 border-t border-orange-500/30 border-b border-orange-500/30">
          <div className="p-3 bg-black/30 rounded-lg border border-orange-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-mono uppercase">System</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400 font-mono">OK</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-mono">CPU</span>
                <span className="text-orange-400 font-mono">12%</span>
              </div>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{ width: '12%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout button */}
        <div className="p-4">
          <button
            onClick={onLogout}
            className="group w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all duration-300 border border-transparent hover:border-red-500/30 font-mono"
          >
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            <span>Logout</span>
          </button>
        </div>

        {/* Decorative corner */}
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-orange-400/30"></div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto relative z-10">
        <Outlet />
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
      `}</style>
    </div>
  )
}
