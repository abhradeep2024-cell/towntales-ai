export function createSupabaseApiKeyFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('Authorization');
    return fetcher(input, { ...init, headers });
  };
}
