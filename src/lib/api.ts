/**
 * Shared API request and error handling utility for ModelMesh frontend.
 * Enforces:
 * 1. HTTP status checks
 * 2. Content-Type validation
 * 3. JSON parsing only when Content-Type is application/json
 * 4. Clean error messages for HTML/text responses (never exposing raw HTML)
 */

export class ApiError extends Error {
  status: number;
  data?: any;
  code?: string;

  constructor(message: string, status: number, data?: any, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

/**
 * Checks whether the response Content-Type is JSON.
 */
export function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return !!contentType && contentType.toLowerCase().includes('application/json');
}

/**
 * Formats a clean error message for non-JSON or HTTP errors.
 * Never exposes raw HTML or text responses to users.
 */
export function formatHttpError(status: number): string {
  if (status === 404) {
    return 'Backend API unavailable (HTTP 404)';
  }
  if (status === 401) {
    return 'Unauthorized request (HTTP 401)';
  }
  if (status === 403) {
    return 'Access forbidden (HTTP 403)';
  }
  if (status >= 500) {
    return `Backend API unavailable (HTTP ${status})`;
  }
  return `Server returned unexpected response (HTTP ${status})`;
}

/**
 * Parses response JSON safely.
 * Only attempts JSON parsing when Content-Type is application/json.
 * For non-JSON (HTML/plain text) or HTTP errors, throws a clean ApiError.
 */
export async function parseApiResponse<T = any>(response: Response): Promise<T> {
  const isJson = isJsonResponse(response);

  // If the server returned HTML or non-JSON content
  if (!isJson) {
    const cleanMessage = formatHttpError(response.status);
    throw new ApiError(cleanMessage, response.status);
  }

  // Parse JSON safely
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(formatHttpError(response.status), response.status);
  }

  // Check HTTP status
  if (!response.ok) {
    const cleanMessage =
      data?.error ||
      data?.message ||
      formatHttpError(response.status);
    throw new ApiError(cleanMessage, response.status, data, data?.code);
  }

  return data as T;
}

/**
 * Safely extracts error details from an HTTP response (e.g. streaming responses).
 * Always returns a clean message and never exposes raw HTML/plain text.
 */
export async function parseApiError(
  response: Response,
  defaultMessage: string = 'Request failed'
): Promise<{ message: string; code?: string; data?: any }> {
  if (!isJsonResponse(response)) {
    return {
      message: formatHttpError(response.status),
    };
  }

  try {
    const data = await response.json();
    return {
      message: data?.error || data?.message || defaultMessage,
      code: data?.code,
      data,
    };
  } catch {
    return {
      message: formatHttpError(response.status),
    };
  }
}

/**
 * Shared API fetch wrapper that executes fetch and parses the response.
 */
export async function apiRequest<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  return parseApiResponse<T>(response);
}
