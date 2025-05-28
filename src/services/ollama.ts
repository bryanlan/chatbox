export const visionCache = new Map<string, boolean>()

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
    const ok = (json?.details?.families ?? []).includes('clip')
    visionCache.set(key, ok)
    return ok
  } catch {
    return false
  }
}
