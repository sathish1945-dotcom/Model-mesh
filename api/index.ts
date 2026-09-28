import type { Request, Response } from 'express';

// Import lazily so configuration/import failures still produce a JSON response.
export default async function handler(req: Request, res: Response) {
  try {
    const { default: app } = await import('../server.ts');
    return app(req, res);
  } catch (error: any) {
    console.error('[API startup]', error?.code || error?.name || 'StartupError');
    return res.status(503).json({ error: 'Backend configuration is unavailable. Please contact support.' });
  }
}
