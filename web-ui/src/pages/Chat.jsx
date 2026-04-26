import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

export default function Chat() {
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [routingResult, setRoutingResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [providers, setProviders] = useState([])
  const [rules, setRules] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [providersData, rulesData] = await Promise.all([
          api.getProviders(),
          api.getRoutingRules(),
        ])
        const nextProviders = Array.isArray(providersData) ? providersData : []
        const nextRules = Array.isArray(rulesData) ? rulesData : []
        setProviders(nextProviders)
        setRules(nextRules)

        if (!model) {
          const firstRuleModel = nextRules.find((rule) => rule.enabled && rule.source_model)?.source_model
          const firstProviderModel = nextProviders.flatMap((provider) => provider.models || [])[0]
          setModel(firstRuleModel || firstProviderModel || 'gpt-4')
        }
      } catch (err) {
        setError(err.message)
      }
    }

    load()
  }, [])

  const suggestedModels = useMemo(() => {
    const fromRules = rules.map((rule) => rule.source_model).filter(Boolean)
    const fromProviders = providers.flatMap((provider) => provider.models || []).filter(Boolean)
    return [...new Set([...fromRules, ...fromProviders])]
  }, [providers, rules])

  const matchedRule = useMemo(() => {
    return rules.find((rule) => rule.enabled && (rule.source_model === model || rule.source_model === '*')) || null
  }, [rules, model])

  const handleSend = async () => {
    if (!prompt.trim() || !model.trim()) return

    setLoading(true)
    setError(null)
    setResponse('')
    setRoutingResult(null)

    try {
      const data = await api.sendChat({
        model: model.trim(),
        messages: [{ role: 'user', content: prompt.trim() }],
      })

      const message = data?.choices?.[0]?.message?.content
      if (message) {
        setResponse(message)
        setRoutingResult(data?.x_routing || null)
      } else {
        setError('Invalid response format from server')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat</h1>
          <p className="text-sm text-gray-400 mt-1">Quick test your model routing without opening an IDE.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr,0.7fr] gap-6">
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Model / Route Name</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gpt-4, claude-opus-4.6, custom-route"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {suggestedModels.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Suggested Models</p>
              <div className="flex flex-wrap gap-2">
                {suggestedModels.map((item) => (
                  <button
                    key={item}
                    onClick={() => setModel(item)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${model === item ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="Ask anything..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              Request goes to <span className="text-gray-300">/v1/chat/completions</span>
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !prompt.trim() || !model.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Routing Preview</h2>
            <div className="text-sm text-gray-300 space-y-2">
              <div>
                <span className="text-gray-500">Requested model</span>
                <p className="text-white mt-1 break-all">{model || '—'}</p>
              </div>
              {matchedRule ? (
                <>
                  <div>
                    <span className="text-gray-500">Matched rule</span>
                    <p className="text-blue-400 mt-1">{matchedRule.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Target provider</span>
                    <p className="text-white mt-1">{matchedRule.target_provider}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Target model</span>
                    <p className="text-white mt-1">{matchedRule.target_model || model || '—'}</p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-gray-700/60 p-3 text-gray-300">
                  No explicit routing rule matched. Default model-to-provider mapping will be used.
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Available Providers</h2>
            <div className="space-y-2">
              {providers.length === 0 ? (
                <p className="text-sm text-gray-500">No providers added yet.</p>
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

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {response && (
        <div className="bg-gray-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Assistant Response</h3>
            <button
              onClick={() => navigator.clipboard?.writeText(response)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
            >
              Copy
            </button>
          </div>
          <div className="text-gray-200 whitespace-pre-wrap leading-7">
            {response}
          </div>

          {routingResult && (
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-3">Resolved Route</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-700/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Provider</p>
                  <p className="text-sm text-white mt-1 break-all">{routingResult.provider_id || '—'}</p>
                </div>
                <div className="rounded-lg bg-gray-700/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Resolved model</p>
                  <p className="text-sm text-white mt-1 break-all">{routingResult.model || model || '—'}</p>
                </div>
                <div className="rounded-lg bg-gray-700/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Rule name</p>
                  <p className="text-sm text-white mt-1 break-all">{routingResult.matched_rule || 'Default mapping'}</p>
                </div>
                <div className="rounded-lg bg-gray-700/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Rule ID</p>
                  <p className="text-sm text-white mt-1 break-all">{routingResult.rule_id || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
