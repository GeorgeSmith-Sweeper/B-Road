/**
 * Shared frontend configuration constants.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Safely parse a JSON error response from the API.
 * Returns a `{ detail: string }` object even if parsing fails.
 */
export async function parseErrorResponse(
  response: Response
): Promise<{ detail: string }> {
  return response.json().catch(() => ({ detail: 'Unknown error' }));
}
