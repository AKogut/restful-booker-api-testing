import { track, type TrackedKind } from './run-registry'

export class CreatedResources {
  private readonly ids = new Set<number>()

  constructor(private readonly kind: TrackedKind) {}

  add(id: number): void {
    this.ids.add(id)
    track(this.kind, id)
  }

  forget(id: number): void {
    this.ids.delete(id)
  }

  all(): number[] {
    return [...this.ids]
  }
}
