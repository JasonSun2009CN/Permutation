/**
 * A tiny OpenAI-compatible mock used for end-to-end smoke tests without
 * spending tokens. It always performs:
 *   get_current_time -> create_reminder (10 minutes from now) -> final answer
 *
 *   node scripts/mock-llm.mjs 8787
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 8787)
const delayMinutes = Number(process.env.MOCK_DELAY_MINUTES ?? 10)

function respond(body, message, finishReason = 'tool_calls') {
  return {
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: null, ...message },
        finish_reason: finishReason,
      },
    ],
  }
}

const server = createServer((request, response) => {
  if (request.method !== 'POST') {
    response.writeHead(405).end()
    return
  }
  let raw = ''
  request.on('data', (chunk) => {
    raw += chunk
  })
  request.on('end', () => {
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      response.writeHead(400).end('bad json')
      return
    }

    const messages = Array.isArray(body.messages) ? body.messages : []
    const toolMessages = messages.filter((message) => message.role === 'tool')
    const userMessage = [...messages].reverse().find((message) => message.role === 'user')
    let message
    let finishReason = 'tool_calls'

    if (toolMessages.length === 0) {
      message = {
        content: '',
        tool_calls: [
          {
            id: 'call_time',
            type: 'function',
            function: { name: 'get_current_time', arguments: '{}' },
          },
        ],
      }
    } else if (toolMessages.length === 1) {
      let now = Date.now()
      try {
        const payload = JSON.parse(toolMessages[0].content)
        if (payload.iso) now = new Date(payload.iso).getTime()
      } catch {
        // keep the real clock as a fallback
      }
      message = {
        content: '',
        tool_calls: [
          {
            id: 'call_create',
            type: 'function',
            function: {
              name: 'create_reminder',
              arguments: JSON.stringify({
                content: String(userMessage?.content ?? '').includes('水')
                  ? '喝水'
                  : '十分钟后要做的事',
                triggerAt: new Date(now + delayMinutes * 60_000).toISOString(),
              }),
            },
          },
        ],
      }
    } else {
      message = {
        content: '已为你安排十分钟后的提醒。到点会弹出系统通知，也可以在应用内处理。',
        tool_calls: [],
      }
      finishReason = 'stop'
    }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(respond(body, message, finishReason)))
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock LLM listening on http://127.0.0.1:${port}/v1`)
})
