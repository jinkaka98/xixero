const API_BASE = window.XIXERO_CONFIG?.apiBase || 'http://localhost:7860'

class XixeroAPI {
  constructor() {
    this.token = localStorage.getItem('xixero_token') || ''
  }

  setToken(token) {
    this.token = token
    localStorage.setItem('xixero_token', token)
  }

  clearToken() {
    this.token = ''
    localStorage.removeItem('xixero_token')
  }

  async request(endpoint, options = {}) {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': this.token,
        ...options.headers,
      },
    })

    if (resp.status === 401) {
      this.clearToken()
      window.location.reload()
      throw new Error('Unauthorized')
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
      throw new Error(err.error || `HTTP ${resp.status}`)
    }

    return resp.json()
  }

  getStatus() { return this.request('/api/status') }
  getProviders() { return this.request('/api/providers') }
  addProvider(data) { return this.request('/api/providers', { method: 'POST', body: JSON.stringify(data) }) }
  deleteProvider(id) { return this.request(`/api/providers/${id}`, { method: 'DELETE' }) }
  testProvider(data) { return this.request('/api/providers/test', { method: 'POST', body: JSON.stringify(data) }) }
  getConfig() { return this.request('/api/config') }
  updateConfig(data) { return this.request('/api/config', { method: 'PUT', body: JSON.stringify(data) }) }
}

export const api = new XixeroAPI()
