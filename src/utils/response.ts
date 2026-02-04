/** Standard success response envelope. */
export type OkResponse<TData, TMeta = undefined> = {
  readonly success: true
  readonly data: TData
  readonly meta?: TMeta
}

/** Standard error response envelope. */
export type ErrResponse<TError, TMeta = undefined> = {
  readonly success: false
  readonly error: TError
  readonly meta?: TMeta
}

/** Create a success envelope. */
export function ok<TData, TMeta = undefined>(data: TData, meta?: TMeta): OkResponse<TData, TMeta> {
  return meta ? { success: true, data, meta } : { success: true, data }
}

/** Create an error envelope. */
export function err<TError, TMeta = undefined>(
  error: TError,
  meta?: TMeta
): ErrResponse<TError, TMeta> {
  return meta ? { success: false, error, meta } : { success: false, error }
}
