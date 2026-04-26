const ADMIN_BASE = window.XIXERO_ADMIN?.apiBase || 'http://localhost:7861'

class AdminAPI {
  constructor() {
    this.token = localStorage.getItem('xixero_admin_token') || ''
  }

  setToken(token) {
    this.token = token
    localStorage.setItem('xixero_admin_token', token)
  }

  clearToken() {
    this.token = ''
    localStorage.removeItem('xixero_admin_token')
  }

  async request(endpoint, options = {}) {
    const resp = await fetch(`${ADMIN_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': this.token,
        ...options.headers,
      },
    })

    if (resp.status === 401) {
      this.clearToken()
      window.location.href = '/admin'
      throw new Error('Unauthorized')
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
      throw new Error(err.error || `HTTP ${resp.status}`)
    }

    return resp.json()
  }

  login(username, password) {
    return fetch(`${ADMIN_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (r) => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Login failed')
      return data
    })
  }

  getDashboard() { return this.request('/admin/api/dashboard') }
  getLicenses() { return this.request('/admin/api/licenses') }
  createLicense(data) { return this.request('/admin/api/licenses', { method: 'POST', body: JSON.stringify(data) }) }
  revokeLicense(key) { return this.request(`/admin/api/licenses/${encodeURIComponent(key)}`, { method: 'DELETE' }) }
}

export const adminApi = new AdminAPI()
