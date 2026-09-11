/**
 * OrcaRouter inference and catalog transport.
 *
 * Both use the OpenAI-compatible API origin with a Bearer credential. A `401`
 * from the relay is terminal: it means the durable key was revoked, so the
 * credential is marked for reauthentication for the exact account and
 * generation that made the call. There is no refresh grant to attempt.
 *
 * @module orcarouter/client
 */

import axios, { AxiosInstance } from 'axios'
import { OrcaCredential, CredentialRejectedError, safeErrorMessage } from './credentials'
import { CATALOG_LIMITS, exceedsByteBudget } from './catalog'
import { OrcaOrigins, buildChatCompletionsUrl, buildModelsUrl } from './origins'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatResult {
  model: string
  content: string
  finishReason?: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

/** Raised for any non-2xx relay response, carrying the status for the caller. */
export class OrcaRequestError extends Error {
  constructor(
    public readonly status: number | undefined,
    message: string
  ) {
    super(message)
    this.name = 'OrcaRequestError'
  }
}

export interface OrcaClientOptions {
  /** Injected for tests; defaults to a bare axios instance. */
  http?: AxiosInstance
  timeoutMs?: number
}

export class OrcaClient {
  private readonly http: AxiosInstance
  private readonly timeoutMs: number

  constructor(
    private readonly origins: OrcaOrigins,
    options: OrcaClientOptions = {}
  ) {
    this.http = options.http ?? axios.create()
    this.timeoutMs = options.timeoutMs ?? 60_000
  }

  private headers(credential: OrcaCredential): Record<string, string> {
    // Bearer only. The key never appears in a URL, a query string or a log.
    return {
      Authorization: `Bearer ${credential.key}`,
      'Content-Type': 'application/json'
    }
  }

  /** Live model catalog for the configured API origin. */
  async listModels(credential: OrcaCredential, capability?: string): Promise<unknown> {
    return this.send(() =>
      this.http.get(buildModelsUrl(this.origins.apiBase, capability), {
        headers: this.headers(credential),
        timeout: CATALOG_LIMITS.timeoutMs,
        maxContentLength: CATALOG_LIMITS.maxBytes,
        maxBodyLength: CATALOG_LIMITS.maxBytes,
        transformResponse: [
          // Enforce the byte budget before parsing, then parse explicitly —
          // overriding the transformer replaces axios's own JSON parsing.
          (raw: string): unknown => {
            if (exceedsByteBudget(raw.length)) {
              throw new Error('OrcaRouter model catalog response exceeded the size budget')
            }
            try {
              return JSON.parse(raw)
            } catch {
              throw new Error('OrcaRouter model catalog response was not valid JSON')
            }
          }
        ]
      })
    )
  }

  /** One chat completion. */
  async chat(credential: OrcaCredential, request: ChatRequest): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens
    if (request.stream !== undefined) body.stream = request.stream

    const payload: any = await this.send(() =>
      this.http.post(buildChatCompletionsUrl(this.origins.apiBase), body, {
        headers: this.headers(credential),
        timeout: this.timeoutMs
      })
    )

    const choice = payload?.choices?.[0]
    return {
      model: typeof payload?.model === 'string' ? payload.model : request.model,
      content: typeof choice?.message?.content === 'string' ? choice.message.content : '',
      finishReason: choice?.finish_reason,
      usage: payload?.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens
          }
        : undefined
    }
  }

  /**
   * Single place where a relay rejection becomes a typed error. A `401` is
   * never retried: the caller marks the exact credential generation for
   * reauthentication and surfaces the state to the user.
   */
  private async send<T>(call: () => Promise<{ data: T; status: number }>): Promise<T> {
    try {
      const response = await call()
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 401) {
          throw new CredentialRejectedError('', 0)
        }
        throw new OrcaRequestError(
          status,
          status === undefined
            ? `Could not reach OrcaRouter: ${safeErrorMessage(error.message)}`
            : `OrcaRouter request failed with HTTP ${status}`
        )
      }
      throw error
    }
  }
}

/** Re-exported so callers do not need to know the module split. */
export { CredentialRejectedError }
