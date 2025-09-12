"use server";

import { fetcher } from "@/lib/utils/fetcher";

const baseUrl = "https://api.coingecko.com/api/v3";

export async function getCoinsList() {
   try {
      const path = "/coins/list";
      const options = {
         method: "GET" as const,
         headers: {
            "x-cg-demo-api-key": process.env.NEXT_PUBLIC_COIN_GECKO_API_KEY || "",
         },
         body: undefined,
      };

      const { data, error } = await fetcher(baseUrl, path, options);

      if (error) {
         return error;
      }

      return data;
   } catch (err: any) { 
      return err;
   }
}
