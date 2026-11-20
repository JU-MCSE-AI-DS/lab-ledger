import type { Course } from '../model';
import { createSpreadsheet, readCourse, HttpError } from './sheets';
import { pickSpreadsheet } from './picker';
import { auth } from './auth.svelte';

export async function createRemoteCourse(base: Course): Promise<Course> {
  await auth.getToken(true);
  const id = await createSpreadsheet(base);
  return { ...base, id, kind: 'google' };
}

export async function openById(id: string): Promise<Course | null> {
  await auth.getToken(true);
  try {
    return await readCourse(id, true);
  } catch (e) {
    // drive.file only grants access to files the app created or the user picked: fall back to Picker.
    if (e instanceof HttpError && (e.status === 403 || e.status === 404)) {
      const picked = await pickSpreadsheet(id);
      return picked ? readCourse(picked, true) : null;
    }
    throw e;
  }
}

export async function openViaPicker(): Promise<Course | null> {
  const id = await pickSpreadsheet();
  return id ? readCourse(id, true) : null;
}
