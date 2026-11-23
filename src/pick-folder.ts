import { createAbortError, FolderPickerError } from './errors.js';
import { pickWindowsFolder } from './platforms/windows.js';

const DEFAULT_TITLE = 'Select a folder';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000;

// Node changes a longer timer to 1 ms, which would close the dialog at once.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type PickFolderOptions = {
  /** Text shown in the dialog. Defaults to `Select a folder`. */
  title?: string | undefined;
  /**
   * How long the dialog may stay open, in whole milliseconds. Defaults to 5
   * minutes. Use `0` to wait forever. The maximum is 2,147,483,647.
   */
  timeout?: number | undefined;
  /** Closes the dialog when aborted. */
  signal?: AbortSignal | undefined;
};

/** What each platform receives, with the defaults already filled in. */
export type ResolvedPickFolderOptions = {
  title: string;
  timeout: number;
  signal: AbortSignal | undefined;
};

// Shared by every caller of this loaded copy of the package. Another process,
// or another installed version, has its own lock.
let isOpen = false;

/**
 * Opens the operating system's folder picker on the machine running Node.js.
 *
 * @returns The absolute path, or `null` if the user cancelled.
 * @throws {FolderPickerError} See `code` for the reason.
 * @throws An error named `AbortError` if `signal` was aborted.
 * @throws {RangeError | TypeError} If an option is invalid.
 */
export async function pickFolder({
  title = DEFAULT_TITLE,
  timeout = DEFAULT_TIMEOUT_MS,
  signal,
}: PickFolderOptions = {}): Promise<string | null> {
  assertValidTimeout(timeout);

  if (signal?.aborted) throw createAbortError(signal);

  assertSupportedPlatform();

  return withLock(() => pickWindowsFolder({ title, timeout, signal }));
}

function assertValidTimeout(timeout: number): void {
  if (Number.isInteger(timeout) && timeout >= 0 && timeout <= MAX_TIMEOUT_MS) {
    return;
  }

  throw new RangeError(
    `timeout must be a whole number from 0 to ${MAX_TIMEOUT_MS}`,
  );
}

function assertSupportedPlatform(): void {
  if (process.platform === 'win32') return;

  throw new FolderPickerError(
    'UNSUPPORTED',
    `The folder picker isn't supported on ${process.platform}`,
  );
}

async function withLock(
  openPicker: () => Promise<string | null>,
): Promise<string | null> {
  if (isOpen) {
    throw new FolderPickerError(
      'ALREADY_OPEN',
      'A folder picker is already open',
    );
  }

  isOpen = true;

  try {
    return await openPicker();
  } finally {
    isOpen = false;
  }
}
