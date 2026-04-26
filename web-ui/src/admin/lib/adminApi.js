import { getLicenses, createLicense, revokeLicense, getDashboardStats, getLicenseByKey } from '../../lib/firebase'

/**
 * Admin API - now powered by Firebase Firestore
 * No more local admin server (port 7861) needed.
 */
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

  // Simple admin auth (password stored locally, not in Firebase for security)
  async login(username, password) {
    // Hardcoded admin credentials for now
    // In production, use Firebase Auth
    if (username === 'admin' && password === 'admin123') {
      const token = 'firebase-admin-' + Date.now()
      return { token }
    }
    throw new Error('Invalid credentials')
  }

  async getDashboard() {
    return getDashboardStats()
  }

  async getLicenses() {
    return getLicenses()
  }

  async createLicense(data) {
    return createLicense(data)
  }

  async revokeLicense(id) {
    await revokeLicense(id)
    return { success: true }
  }
}

export const adminApi = new AdminAPI()
