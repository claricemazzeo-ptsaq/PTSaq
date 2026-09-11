import { Router, type RequestHandler } from "express";

/**
 * Express 4 does not catch rejected promises from async route handlers —
 * an unhandled rejection (e.g. Prisma throwing because Postgres is down)
 * crashes the whole Node process instead of producing a 500. Every route
 * file gets its router from here instead of `Router()` directly so async
 * handlers are wrapped without having to remember try/catch in each one.
 */
function wrap(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export function createAsyncRouter(): Router {
  const router = Router();
  for (const method of HTTP_METHODS) {
    const original = (router[method] as (...args: unknown[]) => Router).bind(router);
    (router as unknown as Record<string, unknown>)[method] = (path: string, ...handlers: RequestHandler[]) =>
      original(path, ...handlers.map(wrap));
  }
  return router;
}
