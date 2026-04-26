import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

export default function Routing() {
  const [rules, setRules] = useState([])
  const [providers, setProviders] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [error, setError] = useState(null)

  const loadData = async () => {
    try {
      const [rulesData, providersData] = await Promise.all([
        api.getRoutingRules(),
        api.getProviders(),
      ])

      setRules(Array.isArray(rulesData) ? rulesData : [])
      setProviders(Array.isArray(providersData) ? providersData : [])
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const providerMap = useMemo(() => {
    return Object.fromEntries(providers.map((provider) => [provider.id, provider]))
  }, [providers])

  const handleDelete = async (id) => {
    if (!confirm('Delete this routing rule?')) return
    try {
      await api.deleteRoutingRule(id)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Routing Rules</h1>
          <p className="text-sm text-gray-400 mt-1">Visually decide which incoming model names should be redirected to which provider and target model.</p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
        >
          + Add Rule
        </button>
      </div>

      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-sm text-blue-200">
        <p className="font-medium mb-1">Trae note</p>
        <p>Trae direct IDE base URL override is limited, but you can still prepare a dedicated provider target here so the route is ready for proxy-based or future integration paths.</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6">
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
              No routing rules configured yet. Add one to redirect requests visually.
            </div>
          ) : (
            rules.map((rule) => {
              const providerInfo = providerMap[rule.target_provider]
              return (
                <div key={rule.id} className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-white font-semibold">{rule.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${rule.enabled ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">Priority {rule.priority}</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">{rule.endpoint_type || 'chat'}</span>
                      </div>
                      <div className="text-sm text-gray-300 flex flex-wrap items-center gap-2">
                        <span className="bg-gray-700/60 px-2 py-1 rounded">{rule.source_model || '*'}</span>
                        <span>→</span>
                        <span className="text-blue-400 font-medium">{providerInfo?.name || rule.target_provider}</span>
                        <span className="text-gray-500">/</span>
                        <span className="bg-gray-700/60 px-2 py-1 rounded">{rule.target_model || rule.source_model || 'same model'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingRule(rule)
                          setShowForm(true)
                        }}
                        className="px-3 py-1 text-blue-300 hover:bg-blue-900/30 rounded transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-3 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Rule Logic</h2>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="rounded-lg bg-gray-700/60 p-3">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Source Model</p>
                <p>Incoming model name from your IDE or Chat page.</p>
              </div>
              <div className="rounded-lg bg-gray-700/60 p-3">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Target Provider</p>
                <p>Destination provider that will actually receive the request.</p>
              </div>
              <div className="rounded-lg bg-gray-700/60 p-3">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Target Model</p>
                <p>Optional model override before request is forwarded.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Available Targets</h2>
            <div className="space-y-2">
              {providers.length === 0 ? (
                <p className="text-sm text-gray-500">Add providers first.</p>
              ) : (
                providers.map((provider) => (
                  <div key={provider.id} className="rounded-lg bg-gray-700/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-white">{provider.name}</span>
                      <span className="text-xs text-gray-400 uppercase">{provider.type}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 break-all">{(provider.models || []).join(', ') || 'No models set'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <RoutingRuleForm
          providers={providers}
          initialRule={editingRule}
          onClose={() => {
            setShowForm(false)
            setEditingRule(null)
          }}
          onSaved={() => {
            setShowForm(false)
            setEditingRule(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function RoutingRuleForm({ providers, initialRule, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initialRule?.name || '',
    source_model: initialRule?.source_model || '',
    target_provider: initialRule?.target_provider || providers[0]?.id || '',
    target_model: initialRule?.target_model || '',
    endpoint_type: initialRule?.endpoint_type || 'chat',
    enabled: initialRule?.enabled ?? true,
    priority: initialRule?.priority ?? 10,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (field, value) => {
    if (field === 'priority') value = parseInt(value, 10) || 0
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (initialRule?.id) {
        await api.updateRoutingRule(initialRule.id, form)
      } else {
        await api.createRoutingRule(form)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white">{initialRule ? 'Edit Routing Rule' : 'Add Routing Rule'}</h2>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Rule Name</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Source Model</label>
          <input value={form.source_model} onChange={(e) => update('source_model', e.target.value)} placeholder="e.g. gpt-4 or *" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Target Provider</label>
          <select value={form.target_provider} onChange={(e) => update('target_provider', e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Target Model</label>
          <input value={form.target_model} onChange={(e) => update('target_model', e.target.value)} placeholder="Leave empty to keep source model" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Endpoint Type</label>
            <select value={form.endpoint_type} onChange={(e) => update('endpoint_type', e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
              <option value="chat">Chat</option>
              <option value="completion">Completion</option>
              <option value="embeddings">Embeddings</option>
              <option value="*">All</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Priority</label>
            <input type="number" value={form.priority} onChange={(e) => update('priority', e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} className="w-4 h-4 rounded bg-gray-700 border-gray-600" />
          Enabled
        </label>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.source_model || !form.target_provider} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors">
            {saving ? 'Saving...' : initialRule ? 'Update Rule' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
