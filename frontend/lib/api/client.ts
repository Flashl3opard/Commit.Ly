import { ApiError } from "./types";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

/**
 * Called whenever any request to a protected endpoint comes back 401,
 * so a single place (AuthContext) can clear session state and redirect
 * instead of every call site re-implementing the same check. Registered
 * by AuthProvider on mount; a no-op until then.
 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0);
  }

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    const message =
      (data as { error?: string } | null)?.error ?? "Something went wrong. Please try again.";
    throw new ApiError(message, response.status, (data as { details?: unknown } | null)?.details);
  }

  return data as T;
}

export function authRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_API_URL;
  if (!baseUrl) {
    throw new ApiError("Auth service URL is not configured.", 0);
  }
  return request<T>(baseUrl, path, options);
}

export function userRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_USER_API_URL;
  if (!baseUrl) {
    throw new ApiError("User service URL is not configured.", 0);
  }
  return request<T>(baseUrl, path, options);
}

export function githubRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_GITHUB_API_URL;
  if (!baseUrl) {
    throw new ApiError("GitHub service URL is not configured.", 0);
  }
  return request<T>(baseUrl, path, options);
}
