import { NextRequest, NextResponse } from 'next/server'
import parseLLMJson from '@/lib/jsonParser'

const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''

// Types
interface NormalizedAgentResponse {
  status: 'success' | 'error'
  result: Record<string, any>
  message?: string
  metadata?: {
    agent_name?: string
    timestamp?: string
    [key: string]: any
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function normalizeResponse(parsed: any): NormalizedAgentResponse {
  if (!parsed) {
    return {
      status: 'error',
      result: {},
      message: 'Empty response from agent',
    }
  }

  if (typeof parsed === 'string') {
    return {
      status: 'success',
      result: { text: parsed },
      message: parsed,
    }
  }

  if (typeof parsed !== 'object') {
    return {
      status: 'success',
      result: { value: parsed },
      message: String(parsed),
    }
  }

  if ('status' in parsed && 'result' in parsed) {
    return {
      status: parsed.status === 'error' ? 'error' : 'success',
      result: parsed.result || {},
      message: parsed.message,
      metadata: parsed.metadata,
    }
  }

  if ('status' in parsed) {
    const { status, message, metadata, ...rest } = parsed
    return {
      status: status === 'error' ? 'error' : 'success',
      result: Object.keys(rest).length > 0 ? rest : {},
      message,
      metadata,
    }
  }

  if ('result' in parsed) {
    return {
      status: 'success',
      result: parsed.result,
      message: parsed.message,
      metadata: parsed.metadata,
    }
  }

  if ('message' in parsed && typeof parsed.message === 'string') {
    return {
      status: 'success',
      result: { text: parsed.message },
      message: parsed.message,
    }
  }

  // Handle Lyzr's response wrapper format
  if ('response' in parsed && typeof parsed.response === 'string') {
    // The response might be JSON in a string, try to parse it
    try {
      const innerParsed = parseLLMJson(parsed.response)
      if (innerParsed) {
        return normalizeResponse(innerParsed)
      }
    } catch {
      // If parsing fails, treat as text
    }
    return normalizeResponse(parsed.response)
  }

  if ('response' in parsed) {
    return normalizeResponse(parsed.response)
  }

  return {
    status: 'success',
    result: parsed,
    message: undefined,
    metadata: undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, agent_id, user_id, session_id, assets } = body

    if (!message || !agent_id) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'message and agent_id are required',
          },
          error: 'message and agent_id are required',
        },
        { status: 400 }
      )
    }

    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'LYZR_API_KEY not configured',
          },
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const finalUserId = user_id || `user-${generateUUID()}`
    const finalSessionId = session_id || `${agent_id}-${generateUUID().substring(0, 12)}`

    const payload: Record<string, any> = {
      message,
      agent_id,
      user_id: finalUserId,
      session_id: finalSessionId,
    }

    if (assets && assets.length > 0) {
      payload.assets = assets
    }

    const response = await fetch(LYZR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const rawText = await response.text()

    console.log('=== LYZR API Raw Response ===')
    console.log('Status:', response.status)
    console.log('Raw Text Length:', rawText.length)
    console.log('Raw Text Preview:', rawText.substring(0, 500))
    console.log('============================')

    if (response.ok) {
      const parsed = parseLLMJson(rawText)

      console.log('=== Parsed Response ===')
      console.log('Parsed:', JSON.stringify(parsed, null, 2))
      console.log('=====================')

      if (parsed?.success === false && parsed?.error) {
        return NextResponse.json({
          success: false,
          response: {
            status: 'error',
            result: {},
            message: parsed.error,
          },
          error: parsed.error,
          raw_response: rawText,
        })
      }

      // Check if the parsed response is already in the correct format
      if (parsed?.status && parsed?.result) {
        console.log('✓ Response is already structured correctly')
        // Response is already structured correctly
        return NextResponse.json({
          success: true,
          response: parsed,
          agent_id,
          user_id: finalUserId,
          session_id: finalSessionId,
          timestamp: new Date().toISOString(),
          raw_response: rawText,
        })
      }

      // Otherwise normalize the response
      console.log('→ Normalizing response')
      const normalized = normalizeResponse(parsed)

      console.log('=== Normalized Response ===')
      console.log(JSON.stringify(normalized, null, 2))
      console.log('=========================')

      return NextResponse.json({
        success: true,
        response: normalized,
        agent_id,
        user_id: finalUserId,
        session_id: finalSessionId,
        timestamp: new Date().toISOString(),
        raw_response: rawText,
      })
    } else {
      let errorMsg = `API returned status ${response.status}`
      try {
        const errorData = parseLLMJson(rawText) || JSON.parse(rawText)
        errorMsg = errorData?.error || errorData?.message || errorMsg
      } catch {}

      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: errorMsg,
          },
          error: errorMsg,
          raw_response: rawText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        response: {
          status: 'error',
          result: {},
          message: errorMsg,
        },
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
