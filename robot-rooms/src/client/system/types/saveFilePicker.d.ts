// Ambient types for showSaveFilePicker (Chromium only, so not in TypeScript's DOM lib): the browser's own
// file browser, asking where a file is to be written.

interface SaveFilePickerOptions
{
    suggestedName?: string;
    types?: {description?: string, accept: Record<string, string[]>}[];
}

interface Window
{
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
