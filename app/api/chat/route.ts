import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: `You are NextTrade AI, a helpful crypto trading assistant. You help users understand:
- Cryptocurrency markets and trading concepts
- Technical analysis basics (support/resistance, trends, indicators)
- Risk management (position sizing, stop losses, leverage risks)
- The NextTrade platform features (wallet, futures trading)

Be concise, friendly, and educational. Always emphasize risk management.
Never give financial advice - provide educational information only.
Format responses with markdown for readability.`,
    messages,
  });

  return result.toDataStreamResponse();
}
