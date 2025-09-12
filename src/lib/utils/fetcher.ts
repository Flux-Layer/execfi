// utils/fetcher.ts

type FetchOptions<TBody = unknown> = {
   method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
   body?: TBody;
   headers?: Record<string, string>;
   cache?: RequestCache; // e.g. "no-store" or "force-cache"
   next?: NextFetchRequestConfig; // Next.js App Router specific
};

type FetchResult<T> = {
   data?: T;
   error?: string;
   status: number;
};

export async function fetcher<TResponse = unknown, TBody = unknown>(
   baseUrl: string,
   path: string,
   options: FetchOptions<TBody> = {},
): Promise<FetchResult<TResponse>> {
   const { method = "GET", body, headers, cache, next } = options;

   try {
      const res = await fetch(`${baseUrl}${path}`, {
         method,
         headers: {
            "Content-Type": "application/json",
            ...headers,
         },
         body: body ? JSON.stringify(body) : undefined,
         cache,
         next,
      });

      const contentType = res.headers.get("content-type");
      const isJSON = contentType?.includes("application/json");

      const responseData = isJSON ? await res.json() : await res.text();

      if (!res.ok) {
         return {
            error: (responseData as any)?.message || res.statusText,
            status: res.status,
         };
      }

      return {
         data: responseData as TResponse,
         status: res.status,
      };
   } catch (err: any) {
      return {
         error: err.message || "Something went wrong",
         status: 500,
      };
   }
}
