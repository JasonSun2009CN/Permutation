import type Database from 'better-sqlite3'
import {
  newId,
  type Conversation,
  type MessageRole,
  type StoredMessage,
  type ToolTrace,
} from '@permutation/shared'

interface ConversationRow {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  tools_json: string
  created_at: string
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessage(row: MessageRow): StoredMessage {
  let tools: ToolTrace[] = []
  try {
    const parsed = JSON.parse(row.tools_json) as unknown
    if (Array.isArray(parsed)) tools = parsed as ToolTrace[]
  } catch {
    tools = []
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    tools,
    createdAt: row.created_at,
  }
}

export class ConversationRepository {
  constructor(private readonly db: Database.Database) {}

  create(title: string, now: Date = new Date()): Conversation {
    const timestamp = now.toISOString()
    const id = newId('conv')
    this.db
      .prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, title.trim() || 'New conversation', timestamp, timestamp)
    return this.get(id) as Conversation
  }

  get(id: string): Conversation | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
      ConversationRow | undefined
    return row ? toConversation(row) : null
  }

  list(limit = 50): Conversation[] {
    const rows = this.db
      .prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?')
      .all(Math.min(Math.max(limit, 1), 200)) as ConversationRow[]
    return rows.map(toConversation)
  }

  touch(id: string, now: Date = new Date()): void {
    this.db
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(now.toISOString(), id)
  }

  rename(id: string, title: string, now: Date = new Date()): void {
    this.db
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.trim(), now.toISOString(), id)
  }
}

export class MessageRepository {
  constructor(private readonly db: Database.Database) {}

  add(
    input: {
      conversationId: string
      role: MessageRole
      content: string
      tools?: ToolTrace[]
    },
    now: Date = new Date(),
  ): StoredMessage {
    const id = newId('msg')
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, tools_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.conversationId,
        input.role,
        input.content,
        JSON.stringify(input.tools ?? []),
        now.toISOString(),
      )
    return {
      id,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      tools: input.tools ?? [],
      createdAt: now.toISOString(),
    }
  }

  list(conversationId: string, limit = 200): StoredMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ?
          ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(conversationId, Math.min(Math.max(limit, 1), 500)) as MessageRow[]
    return rows.reverse().map(toMessage)
  }

  recent(conversationId: string, limit: number): StoredMessage[] {
    return this.list(conversationId, limit)
  }
}
