/**
 * Chat API client for natural language road search.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatSearchResult {
  query: string;
  filters: Record<string, unknown>;
  results: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id: string;
      geometry: {
        type: 'LineString';
        coordinates: Array<[number, number]>;
      };
      properties: {
        id: number;
        id_hash: string;
        name: string;
        curvature: number;
        curvature_level: string;
        length: number;
        length_km: number;
        length_mi: number;
        paved: boolean;
        surface: string;
        source: string;
      };
    }>;
    metadata: {
      count: number;
    };
  };
  count: number;
}

/**
 * Send a natural language query to the chat search API.
 */
export async function sendChatMessage(
  query: string,
  limit: number = 10
): Promise<ChatSearchResult> {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/chat/search?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if the chat service is available.
 */
export async function checkChatHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.claude_available === true;
  } catch {
    return false;
  }
}
