import { metaprompt } from "@/constants/ai-meta-prompt";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { prompt: string };
    const prompt = body.prompt;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: metaprompt + `User prompt: > ${prompt}` },
        ],
      }),
    });

    const data = await res.json() as any;
    console.log({ aiResponse: res });


    const rawResponse = data?.choices?.[0]?.message?.content

    const cleaned = rawResponse
      .replace(/'\s*\+\s*'/g, "") // remove "' + '"
      .replace(/^'/, "")          // strip leading quote
      .replace(/'$/, "");

      const cleanedAsJson = JSON.parse(cleaned)

    console.log({ cleanedAsJson });

    return NextResponse.json({
      output: cleanedAsJson,
    });
  } catch (err: any) {
    console.error("OpenRouter API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
