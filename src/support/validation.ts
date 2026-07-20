const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined

export const validationMessages = (data: unknown): string[] | undefined => {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  if ('errors' in data) {
    return asStringArray(data.errors)
  }
  if ('fieldErrors' in data) {
    return asStringArray(data.fieldErrors)
  }
  return undefined
}
