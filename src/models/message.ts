export interface MessagePayload {
  name: string
  email: string
  phone: string
  subject: string
  description: string
}

export interface Message extends MessagePayload {
  messageid: number
}

export interface MessageSummary {
  id: number
  name: string
  subject: string
  read: boolean
}

export interface MessageList {
  messages: MessageSummary[]
}

export interface UnreadCount {
  count: number
}
