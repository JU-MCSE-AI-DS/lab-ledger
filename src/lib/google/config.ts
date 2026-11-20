export const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '') as string;
export const API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY ?? '') as string;
export const APP_ID = (import.meta.env.VITE_GOOGLE_APP_ID ?? '') as string;
/** Google features are enabled only when all three public values are provided at build time. */
export const googleEnabled = !!(CLIENT_ID && API_KEY && APP_ID);
export const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email';
