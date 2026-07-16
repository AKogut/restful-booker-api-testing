export interface ErrorResponse {
  error: string
}

export interface ErrorsResponse {
  errors: string[]
}

export interface SuccessResponse {
  success: boolean
}

export interface ValidationErrorResponse {
  error: string
  errorCode: number
  errorMessage: string
}
