import { gfetch } from './sheets';

export async function inviteTA(fileId: string, email: string) {
  await gfetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`, {
    method: 'POST',
    body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email })
  }, true);
}
