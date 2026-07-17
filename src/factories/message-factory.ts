import { faker } from '@faker-js/faker'
import type { MessagePayload } from '@models/message'

export const messagePayload = (overrides: Partial<MessagePayload> = {}): MessagePayload => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: faker.string.numeric(11),
  subject: faker.lorem.words({ min: 3, max: 6 }),
  description: faker.lorem.sentences({ min: 2, max: 4 }),
  ...overrides,
})
