import { fetcher } from "@/lib/utils/fetcher";

export type TRelayGetTokenRequest = {
  chainIds: number[];
  term?: string;
  limit?: number;
};

export async function POST(request: Request) {
  try {
    const requestData = await request.json() as TRelayGetTokenRequest;

    console.log({ requestData });

    const baseUrl = "https://api.relay.link";
    const apiPath = "/currencies/v2";

    const payload = {
      chainIds: requestData?.chainIds || [8453],
      term: requestData?.term || "",
      defaultList: false,
      limit: requestData?.limit || 10,
      depositAddressOnly: false,
      referrer: "relay.link",
    };

    const options = {
      method: "POST" as const,
      headers: {},
      body: payload,
    };

    const { data, error } = await fetcher(baseUrl, apiPath, options);

    console.log({ relayRespopnse: data });

    if (error) {
      return Response.error();
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({});
  }
}
