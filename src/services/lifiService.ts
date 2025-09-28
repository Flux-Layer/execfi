export async function lifiService(params: {
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    fromAddress: string;
    toAddress?: string;
    order?: "FASTEST" | "CHEAPEST";
    slippage?: number;
  }) {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress,
      order = "CHEAPEST",
      slippage = 0.005,
    } = params;
  
    const query = new URLSearchParams({
      fromChain: String(fromChain),
      toChain: String(toChain),
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress: toAddress ?? fromAddress,
      order,
      slippage: String(slippage),
      integrator: "execFii",
      fee: "0.01",
    });
  
    const url = `https://li.quest/v1/quote?${query.toString()}`;
  
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "x-lifi-api-key": process.env.NEXT_PUBLIC_LIFI_API_KEY!,
        },
        cache: "no-store",
      });
  
      if (!res.ok) {
        throw new Error(`LiFi API error: ${res.status} ${res.statusText}`);
      }
  
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Error fetching LiFi quote:", err);
      throw err;
    }
  }
