import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export async function verifyGoogleIdentity(idToken: unknown) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 16384) {
    throw new Error('A Firebase ID token is required');
  }
  const app = getApps().find(app => app.name === 'modelmesh-auth') ||
    initializeApp({ projectId: firebaseConfig.projectId }, 'modelmesh-auth');
  const claims = await getAuth(app).verifyIdToken(idToken);
  if (!claims.email || claims.email_verified !== true ||
      claims.firebase?.sign_in_provider !== 'google.com') {
    throw new Error('A verified Google identity is required');
  }
  return { email: claims.email.toLowerCase(), name: claims.name || claims.email.split('@')[0] };
}
