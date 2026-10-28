/**
 * Saving a text the app made (the Verlauf's Markdown export) where the
 * student picks. In the desktop app the system's save dialog asks
 * (`export_save` in src-tauri), and only the path picked there is written; in
 * the browser it is a download.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

/** True once saved; false when the student cancelled the dialog. */
export async function saveText(name: string, text: string, type: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>('export_save', { name, text });
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
