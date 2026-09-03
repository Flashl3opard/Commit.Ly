import type { Request, Response, NextFunction } from "express";

const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;

if (!INTERNAL_SERVICE_SECRET) {
  throw new Error("INTERNAL_SERVICE_SECRET environment variable is not set");
}

/**
 * Restricts a route to trusted backend services (e.g. GitHub Service)
 * presenting the shared internal secret. Never exposed to or callable
 * from the browser.
 */
export function internalServiceMiddleware(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-internal-service-secret");

  if (!provided || provided !== INTERNAL_SERVICE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}
