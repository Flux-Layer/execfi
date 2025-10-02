export async function rpc<T = any>(
  url: string,
  method: string,
  params: any[]
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await res.json();
  if (body.error)
    throw new Error(`${method} RPC error: ${JSON.stringify(body.error)}`);
  return body.result as T;
}
