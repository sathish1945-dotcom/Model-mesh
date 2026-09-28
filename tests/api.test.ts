import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const originalDirectory = process.cwd();
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'modelmesh-test-'));
process.chdir(temporaryDirectory);
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
process.env.AUTH_SECRET = randomBytes(48).toString('base64');
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { default: app } = await import('../server.ts');
const { PostgresDatabase } = await import('../src/server/postgres.ts');
const { readApiResponse } = await import('../src/lib/api-response.ts');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}`;
const post = (path: string, body: unknown, cookie = '') => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  process.chdir(originalDirectory);
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('API config and missing routes return JSON', async () => {
  assert.equal((await (await fetch(base + '/api/config')).json()).appName, 'ModelMesh');
  const missing = await fetch(base + '/api/missing');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'API route not found');
});

test('malformed JSON and forged Google identity fail without a session', async () => {
  const invalid = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, 'Invalid JSON request');
  for (const body of [{ email: 'victim@example.com' }, { idToken: 'forged.token.value' }]) {
    const response = await post('/api/auth/google', body);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('register, login, session, and chat ownership work together', async () => {
  const body = { email: 'first@example.com', password: 'test-password-only', name: 'Test' };
  const registered = await post('/api/auth/register', body);
  assert.equal(registered.status, 201);
  const first = await registered.json();
  const cookie = registered.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).json()).user.id, first.user.id);
  assert.equal((await post('/api/auth/register', body)).status, 409);
  assert.equal((await post('/api/auth/login', { ...body, password: 'wrong' })).status, 401);
  assert.equal((await post('/api/auth/login', body)).status, 200);
  const chat = await (await post('/api/chats', { title: 'Private' }, cookie)).json();
  const second = await post('/api/auth/register', { ...body, email: 'second@example.com' });
  const secondCookie = second.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(base + '/api/chats/' + chat.chat.id, { headers: { Cookie: secondCookie } })).status, 404);
  assert.equal((await fetch(base + '/api/chats')).status, 401);
});

test('invalid encryption configuration returns JSON 503', async () => {
  const saved = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = 'invalid';
  try {
    const response = await fetch(base + '/api/config');
    assert.equal(response.status, 503);
    assert.ok((await response.json()).error);
  } finally { process.env.APP_ENCRYPTION_KEY = saved; }
});

test('PostgreSQL refuses missing configuration rather than falling back to disk', async () => {
  await assert.rejects(new PostgresDatabase().createUser({ email: 'test@example.com', name: 'Test', auth_provider: 'email' }), /DATABASE_URL/);
});

test('frontend gives a useful error for a plain-text Vercel error', async () => {
  await assert.rejects(readApiResponse(new Response('The page could not be found', {
    status: 404, headers: { 'Content-Type': 'text/plain' },
  })), /HTTP 404/);
});
