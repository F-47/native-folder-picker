import {
  execFile,
  type ChildProcess,
  type ExecFileException,
} from 'node:child_process';
import { win32 } from 'node:path';
import { promisify } from 'node:util';
import { createAbortError, FolderPickerError } from '../errors.js';
import type { ResolvedPickFolderOptions } from '../pick-folder.js';

const execFileAsync = promisify(execFile);

const TITLE_VARIABLE = 'NATIVE_FOLDER_PICKER_TITLE';

// Keep this script constant. The title comes from an environment variable,
// because text placed inside the script could run as PowerShell code.
//
// 'Stop' ends the script at the first error, instead of going on with a dialog
// that was only partly created.
//
// The path is written as raw UTF-8 bytes because [Console]::Write uses the
// console code page, which loses characters. Changing
// [Console]::OutputEncoding could also change the parent's own terminal.
const SCRIPT = `
  $ErrorActionPreference = 'Stop'

  Add-Type -AssemblyName System.Windows.Forms

  $owner = New-Object System.Windows.Forms.Form
  $owner.TopMost = $true
  $owner.ShowInTaskbar = $false
  $owner.WindowState = 'Minimized'
  $owner.Show()

  try {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $env:${TITLE_VARIABLE}
    $dialog.ShowNewFolderButton = $false

    if ($dialog.ShowDialog($owner) -eq 'OK') {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)
      $output = [Console]::OpenStandardOutput()
      $output.Write($bytes, 0, $bytes.Length)
      $output.Flush()
    }

    $dialog.Dispose()
  }
  finally {
    $owner.Dispose()
  }
`;

// A full path, so a fake powershell.exe earlier in the search path can't run.
// `||` keeps it absolute when SystemRoot is empty. PowerShell itself then fails.
function getPowerShellPath(): string {
  return win32.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
}

function isTimeout(error: unknown): boolean {
  const { killed, code } = error as ExecFileException;
  return killed === true && code == null;
}

function waitForExit(child: ChildProcess): Promise<void> {
  const isRunning =
    child.pid !== undefined &&
    child.exitCode === null &&
    child.signalCode === null;

  if (!isRunning) return Promise.resolve();

  return new Promise((resolve) => {
    child.once('exit', () => resolve());
  });
}

function openDialog({ title, timeout, signal }: ResolvedPickFolderOptions) {
  return execFileAsync(
    getPowerShellPath(),
    ['-NoProfile', '-NonInteractive', '-STA', '-Command', SCRIPT],
    {
      env: { ...process.env, [TITLE_VARIABLE]: title },
      timeout,
      ...(signal ? { signal } : {}),
    },
  );
}

function toPickerError(error: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted) return createAbortError(signal);

  if (isTimeout(error)) {
    return new FolderPickerError(
      'TIMEOUT',
      'The folder picker was open for too long',
      { cause: error },
    );
  }

  return new FolderPickerError('FAILED', "Couldn't open the folder picker", {
    cause: error,
  });
}

export async function pickWindowsFolder(
  options: ResolvedPickFolderOptions,
): Promise<string | null> {
  const dialog = openDialog(options);

  try {
    const { stdout } = await dialog;

    // Not trimmed: the script adds no newline, and a name can end in a space
    // character that trim() would remove.
    return stdout || null;
  } catch (error) {
    // execFile rejects on abort before the dialog has actually closed.
    await waitForExit(dialog.child);

    throw toPickerError(error, options.signal);
  }
}
