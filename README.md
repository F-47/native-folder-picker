# native-folder-picker

Open the operating system's folder picker from Node.js and get the absolute path of the selected folder.

Browsers never expose absolute paths, so a local-first app has to open the dialog from its own backend. This package does that part.

- No dependencies and no native builds
- Cancellable with an `AbortSignal`, and closes itself after a timeout
- Keeps folder names in any language intact
- One dialog at a time
- Errors with a `code` you can check

## Requirements

- Node.js 22 or newer
- Windows, in a desktop session

| Platform | Status                      |
| -------- | --------------------------- |
| Windows  | Supported                   |
| macOS    | Planned (`UNSUPPORTED` now) |
| Linux    | Planned (`UNSUPPORTED` now) |

## Usage

```ts
import { pickFolder } from 'native-folder-picker';

const path = await pickFolder({ title: 'Select a project folder' });

if (path === null) {
  console.log('Cancelled');
} else {
  console.log(path);
}
```

## API

### `pickFolder(options?): Promise<string | null>`

Resolves with the absolute path, or `null` if the user cancels.

| Option    | Type          | Default             | Description                                                                                          |
| --------- | ------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `title`   | `string`      | `'Select a folder'` | Text shown in the dialog                                                                             |
| `timeout` | `number`      | `300000`            | How long it may stay open, in whole milliseconds. `0` waits forever, and the maximum is `2147483647` |
| `signal`  | `AbortSignal` | none                | Closes the dialog when aborted                                                                       |

### Errors

If `signal` is aborted, the promise rejects with an error whose `name` is `AbortError`. Invalid options reject with a `TypeError` or `RangeError`. Everything else is a `FolderPickerError` with a `code`:

| Code           | Meaning                                                          | Suggested HTTP status |
| -------------- | ---------------------------------------------------------------- | --------------------- |
| `ALREADY_OPEN` | Another picker is already open (see [Limitations](#limitations)) | 409                   |
| `TIMEOUT`      | The picker stayed open longer than `timeout`                     | 408                   |
| `UNSUPPORTED`  | The operating system isn't supported                             | 501                   |
| `FAILED`       | The picker couldn't be opened. Check `cause`                     | 500                   |

## Using it in a server

Close the dialog when the browser disconnects, and turn the error codes into HTTP statuses. For example, in NestJS:

```ts
import { Controller, HttpException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FolderPickerError, pickFolder } from 'native-folder-picker';

const STATUS_BY_CODE = {
  ALREADY_OPEN: 409,
  TIMEOUT: 408,
  UNSUPPORTED: 501,
  FAILED: 500,
};

@Controller('projects')
export class ProjectsController {
  @Post('select-folder')
  async selectFolder(@Res({ passthrough: true }) response: Response) {
    const controller = new AbortController();
    response.once('close', () => controller.abort());

    try {
      return await pickFolder({ signal: controller.signal });
    } catch (error) {
      // The browser is gone, so nobody is waiting for the result.
      if (controller.signal.aborted) return null;

      if (error instanceof FolderPickerError) {
        throw new HttpException(error.message, STATUS_BY_CODE[error.code], {
          cause: error,
        });
      }

      throw error;
    }
  }
}
```

## Security

This package opens the dialog. It doesn't protect your endpoint, so the app still has to:

- Listen on `127.0.0.1` only
- Require authentication, and check the `Origin` and `Host` headers
- Validate every path it receives, because a client can send any path without using the dialog
- Decide whether to accept network paths such as `\\server\share`, because the user can pick one

Don't take `title` or `timeout` from a request. A client could show a misleading message, or keep the dialog open so that nobody else can use it.

## Limitations

- The dialog opens on the machine running Node.js, so it doesn't work for a remote server, a container or a headless session.
- The lock covers one loaded copy of the package. Two Node.js processes, or two installed versions, can each open a dialog.
- Windows shows the classic tree dialog, not the modern one.

## Development

```sh
pnpm install
pnpm build         # compile to dist
pnpm dev           # compile on every change
pnpm example       # open a real dialog
pnpm typecheck
pnpm lint
pnpm format:check
```

## License

[MIT](LICENSE)
