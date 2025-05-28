import type { ModelHelpers } from './types'
import OpenAICompatible from './openai-compatible'
import { normalizeOpenAIApiHostAndPath } from './llm_utils'
import storage from '@/storage'
import { getMessageText } from '@/utils/message'
import { ApiError } from './errors'
import { Message, MessageTextPart, MessageContentParts, StreamTextResult } from '../../../shared/types'
import { CallChatCompletionOptions } from './types'

const helpers: ModelHelpers = {
  isModelSupportVision: (model: string) => {
    return [
      'gemma3',
      'llava',
      'llama3.2-vision',
      'llava-llama3',
      'moondream',
      'bakllava',
      'llava-phi3',
      'granite3.2-vision',
    ].some((m) => model.startsWith(m))
  },
  isModelSupportToolUse: (model: string) => {
    return [
      'qwq',
      'llama3.3',
      'llama3.2',
      'llama3.1',
      'mistral',
      'qwen2.5',
      'qwen2.5-coder',
      'qwen2',
      'mistral-nemo',
      'mixtral',
      'smollm2',
      'mistral-small',
      'command-r',
      'hermes3',
      'mistral-large',
    ].some((m) => model.startsWith(m))
  },
}

interface Options {
  ollamaHost: string
  ollamaModel: string
  temperature: number
}

export default class Ollama extends OpenAICompatible {
  public name = 'Ollama'
  public static helpers = helpers

  constructor(public options: Options) {
    super({
      apiKey: 'ollama',
      apiHost: normalizeOpenAIApiHostAndPath({ apiHost: options.ollamaHost }).apiHost,
      model: options.ollamaModel,
      temperature: options.temperature,
    })
  }

  async chat(messages: Message[], options: CallChatCompletionOptions): Promise<StreamTextResult> {
    const hasImage = messages.some((m) => m.contentParts?.some((p) => p.type === 'image'))
    if (!hasImage) {
      return super.chat(messages, options)
    }
    const mapped = await Promise.all(
      messages.map(async (m) => {
        const msg: any = { role: m.role, content: getMessageText(m) }
        if (m.role === 'user') {
          const images: string[] = []
          for (const part of m.contentParts || []) {
            if (part.type === 'image') {
              const data = (await storage.getBlob(part.storageKey))?.replace(/^data:image\/[^;]+;base64,/, '')
              if (data) images.push(data)
            }
          }
          if (images.length) msg.images = images
        }
        return msg
      }),
    )

    const res = await fetch(this.options.ollamaHost.replace(/\/$/, '') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.options.ollamaModel,
        stream: !options.signal ? false : true,
        messages: mapped,
      }),
      signal: options.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (text.includes('failed processing images')) {
        throw new ApiError(
          `Image too large for ${this.options.ollamaModel}'s context window. Try a smaller image or a model with a bigger num_ctx.`,
        )
      }
      throw new ApiError(`Status Code ${res.status}, ${text}`)
    }

    if (!res.body) {
      const json = await res.json()
      return { contentParts: [{ type: 'text', text: json.message.content }] }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const textPart: MessageTextPart = { type: 'text', text: '' }
    const contentParts: MessageContentParts = [textPart]

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        const data = JSON.parse(line)
        if (data.done) {
          break
        }
        if (data.message?.content) {
          textPart.text += data.message.content
          options.onResultChange?.({ contentParts })
        }
      }
    }

    return { contentParts }
  }

  isSupportToolUse(): boolean {
    return helpers.isModelSupportToolUse(this.options.ollamaModel)
  }
}
