import { beforeAll } from 'vitest'

type Establish = () => Promise<void> | void

const establishers: Establish[] = []

export const establishFixtures = (establish: Establish): void => {
  establishers.push(establish)
  beforeAll(establish)
}

export const reestablishFixtures = async (): Promise<void> => {
  for (const establish of establishers) {
    await establish()
  }
}
