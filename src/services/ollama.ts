export const visionCache = new Map<string, boolean>()

/**
 * Return true when the model accepts an `images` array.
 * Works on every Ollama >= 0.6.4 and degrades gracefully on older builds.
 */
export async function supportsVision(host: string, model: string): Promise<boolean> {
  const key = host + '|' + model
  if (visionCache.has(key)) return visionCache.get(key)!
  
  try {
    const res = await fetch(host.replace(/\/$/, '') + '/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    })
    const json = await res.json()
    
    if (!json) {
      visionCache.set(key, false)
      return false
    }
    
    // v0.6.4+ — authoritative check for capabilities at top level
    if (Array.isArray(json.capabilities) && json.capabilities.includes('vision')) {
      visionCache.set(key, true)
      return true
    }
    
    // fallback for v0.6.0 – 0.6.3 (older LLaVA-style models)
    const d = json.details ?? {}
    if (d.projector?.architecture === 'clip') {
      visionCache.set(key, true)
      return true
    }
    
    if ((d.families ?? []).includes('clip')) {
      visionCache.set(key, true)
      return true
    }
    
    visionCache.set(key, false)
    return false
  } catch (error) {
    visionCache.set(key, false)
    return false
  }
}
