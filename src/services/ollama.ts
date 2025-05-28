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
    
    if (!json?.details) {
      console.log(`[Ollama Vision Check] No details found for ${model}`)
      visionCache.set(key, false)
      return false
    }
    
    const d = json.details
    
    /* 1. Preferred: capabilities[] includes 'vision' */
    if (Array.isArray(d.capabilities) && d.capabilities.includes('vision')) {
      console.log(`[Ollama Vision Check] ${model} supports vision via capabilities array: ${d.capabilities}`)
      visionCache.set(key, true)
      return true
    }
    
    /* 2. Check if families string contains vision-related keywords */
    if (typeof d.families === 'string') {
      const families = d.families.toLowerCase()
      if (families.includes('vl') || families.includes('vision') || families.includes('qwen25vl') || families.includes('llava')) {
        console.log(`[Ollama Vision Check] ${model} supports vision via families string: ${d.families}`)
        visionCache.set(key, true)
        return true
      }
    }
    
    /* 3. Fallback for 0.6.0 – 0.6.3 where some models had clip in families array */
    if (Array.isArray(d.families) && d.families.includes('clip')) {
      console.log(`[Ollama Vision Check] ${model} supports vision via families array (legacy): ${d.families}`)
      visionCache.set(key, true)
      return true
    }
    
    if (d.projector?.architecture === 'clip') {
      console.log(`[Ollama Vision Check] ${model} supports vision via projector architecture: ${d.projector?.architecture}`)
      visionCache.set(key, true)
      return true
    }
    
    /* 4. Check model name patterns for known vision models */
    const modelLower = model.toLowerCase()
    if (modelLower.includes('vl') || modelLower.includes('vision') || modelLower.includes('llava') || modelLower.includes('qwen2.5vl')) {
      console.log(`[Ollama Vision Check] ${model} supports vision via model name pattern`)
      visionCache.set(key, true)
      return true
    }
    
    console.log(`[Ollama Vision Check] ${model} does not support vision. Capabilities: ${d.capabilities}, Families: ${d.families}, Projector: ${d.projector?.architecture}`)
    visionCache.set(key, false)
    return false
  } catch (error) {
    console.error(`[Ollama Vision Check] Error checking vision support for ${model}:`, error)
    visionCache.set(key, false)
    return false
  }
}
