export type FolderPickerErrorCode =
  /** Another folder picker is already open in this process. */
  | 'ALREADY_OPEN'
  /** The picker stayed open longer than the `timeout` option. */
  | 'TIMEOUT'
  /** This operating system isn't supported. */
  | 'UNSUPPORTED'
  /** The picker couldn't be opened. See `cause` for the reason. */
  | 'FAILED';

export class FolderPickerError extends Error {
  override readonly name = 'FolderPickerError';

  constructor(
    readonly code: FolderPickerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function createAbortError(signal: AbortSignal): Error {
  return new DOMException('The folder picker was aborted', {
    name: 'AbortError',
    cause: signal.reason,
  });
}
