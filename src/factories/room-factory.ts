import { faker } from '@faker-js/faker'
import type { RoomPayload, RoomType } from '@models/room'

const ROOM_TYPES: RoomType[] = ['Single', 'Twin', 'Double', 'Family', 'Suite']
const ROOM_FEATURES = ['TV', 'WiFi', 'Safe', 'Radio', 'Views']

export const roomPayload = (overrides: Partial<RoomPayload> = {}): RoomPayload => ({
  roomName: faker.string.numeric(8),
  type: faker.helpers.arrayElement(ROOM_TYPES),
  accessible: faker.datatype.boolean(),
  image: '/images/room2.jpg',
  description: faker.lorem.sentence(),
  features: faker.helpers.arrayElements(ROOM_FEATURES, { min: 1, max: 3 }),
  roomPrice: faker.number.int({ min: 50, max: 999 }),
  ...overrides,
})
