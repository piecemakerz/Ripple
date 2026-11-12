export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}
