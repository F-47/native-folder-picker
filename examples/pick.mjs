import { FolderPickerError, pickFolder } from 'native-folder-picker';

try {
  const path = await pickFolder({ title: 'Pick any folder' });

  console.log(path === null ? 'Cancelled' : `Selected: ${path}`);
} catch (error) {
  if (!(error instanceof FolderPickerError)) throw error;

  console.error(`${error.code}: ${error.message}`);
  process.exitCode = 1;
}
