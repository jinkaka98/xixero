import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function Providers() {
  const [providers, setProviders] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)

  const loadProviders = async () => {
    try {
      const data = await api.getProviders()
      setProviders(data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { loadProviders() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this provider?')) return
    try {
      await api.deleteProvider(id)
      loadProviders()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Providers</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Provider
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          No providers configured yet. Click "Add Provider" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">{p.name}</h3>
                <div className="flex gap-3 mt-1 text-sm text-gray-400">
                  <span className="bg-gray-700 px-2 py-0.5 rounded">{p.type}</span>
                  {p.models?.map((m) => (
                    <span key={m} className="bg-gray-700 px-2 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="px-3 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AddProviderForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadProviders() }}
        />
      )}
    </div>
  )
}

function AddProviderForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', type: 'enowx', endpoint: '', api_key: '', models: '' })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (field, value) => setForm({ ...form, [field]: value })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testProvider({
        type: form.type,
        endpoint: form.endpoint,
        api_key: form.api_key,
      })
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.addProvider({
        ...form,
        models: form.models.split(',').map((m) => m.trim()).filter(Boolean),
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-xl font-bold text-white">Add Provider</h2>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Name</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Type</label>
          <select value={form.type} onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
            <option value="enowx">enowX AI</option>
            <option value="openai">0penAI</option>
            <option value="trae">Trae</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Endpoint</label>
          <input value={form.endpoint} onChange={(e) => update('endpoint', e.target.value)}
            placeholder="https://api.enowx.com/v1"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">API Key</label>
          <input type="password" value={form.api_key} onChange={(e) => update('api_key', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Models (comma-separated)</label>
          <input value={form.models} onChange={(e) => update('models', e.target.value)}
            placeholder="claude-sonnet-4, gpt-4"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>

        {testResult && (
          <div className={`px-4 py-2 rounded-lg text-sm ${testResult.success ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {testResult.success ? `Connected (${testResult.latency_ms}ms)` : `Failed: ${testResult.error}`}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleTest} disabled={testing || !form.endpoint || !form.api_key}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded-lg transition-colors">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.endpoint || !form.api_key}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
