import { API_KEY, APP_ID } from './config';
import { auth, loadGapi } from './auth.svelte';

/** Opens the Google Picker (spreadsheets only). Optionally prefiltered to one file id. Resolves to the picked id or null. */
export async function pickSpreadsheet(fileId?: string): Promise<string | null> {
  const token = await auth.getToken(true);
  await loadGapi();
  await new Promise<void>((res) => gapi.load('picker', () => res()));
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setIncludeFolders(false).setSelectFolderEnabled(false);
    if (fileId) view.setFileIds(fileId);
    new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setTitle('Choose a Lab Ledger course')
      .setCallback((d: google.picker.ResponseObject) => {
        if (d.action === google.picker.Action.PICKED) resolve(d.docs![0].id);
        else if (d.action === google.picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
