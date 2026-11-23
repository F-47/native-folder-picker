# Changelog

This project follows [Semantic Versioning](https://semver.org).

## 0.1.0

First release.

- `pickFolder()` opens the Windows folder picker and returns the absolute path, or `null` on cancel
- `title`, `timeout` and `signal` options
- `FolderPickerError` with the codes `ALREADY_OPEN`, `TIMEOUT`, `UNSUPPORTED` and `FAILED`
