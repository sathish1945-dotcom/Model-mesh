export async function readApiResponse(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`The server is unavailable (HTTP ${response.status}). Please try again later.`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status})`);
  return data;
}
