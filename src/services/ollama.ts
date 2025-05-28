export const visionCache = new Map<string, boolean>()

/**
 * Return true when the model accepts an `images` array.
 * Works on every Ollama >= 0.6.4 and degrades gracefully on older builds.
 */
export async function supportsVision(host: string, model: string): Promise<boolean> {
  const key = host + '|' + model
  if (visionCache.has(key)) return visionCache.get(key)!
  
  try {
    console.log(`[Ollama Vision Check] Checking vision support for model: ${model} at host: ${host}`)
    const res = await fetch(host.replace(/\/$/, '') + '/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    })
    const json = await res.json()
    console.log(`[Ollama Vision Check] API response for ${model}:`, json)
    
    if (!json) {
      console.log(`[Ollama Vision Check] No response for ${model}`)
      visionCache.set(key, false)
      return false
    }
    
    // v0.6.4+ — authoritative check for capabilities at top level
    if (Array.isArray(json.capabilities) && json.capabilities.includes('vision')) {
      console.log(`[Ollama Vision Check] ${model} supports vision via top-level capabilities: ${json.capabilities}`)
      visionCache.set(key, true)
      return true
    }
    
    // fallback for v0.6.0 – 0.6.3 (older LLaVA-style models)
    const d = json.details ?? {}
    if (d.projector?.architecture === 'clip') {
      console.log(`[Ollama Vision Check] ${model} supports vision via projector architecture (legacy): ${d.projector?.architecture}`)
      visionCache.set(key, true)
      return true
    }
    
    if ((d.families ?? []).includes('clip')) {
      console.log(`[Ollama Vision Check] ${model} supports vision via families clip (legacy): ${d.families}`)
      visionCache.set(key, true)
      return true
    }
    
    console.log(`[Ollama Vision Check] ${model} does not support vision. Capabilities: ${json.capabilities}, Projector: ${d.projector?.architecture}, Families: ${d.families}`)
    visionCache.set(key, false)
    return false
  } catch (error) {
    console.error(`[Ollama Vision Check] Error checking vision support for ${model}:`, error)
    visionCache.set(key, false)
    return false
  }
}
