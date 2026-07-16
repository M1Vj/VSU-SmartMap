export function createStreamingResponse(
  generator: AsyncGenerator<string, void, unknown>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function* streamChatResponse(
  content: string,
  chunkSize = 10
): AsyncGenerator<string, void, unknown> {
  const words = content.split(" ");
  let buffer = "";

  for (let i = 0; i < words.length; i++) {
    buffer += (i > 0 ? " " : "") + words[i];

    if (buffer.length >= chunkSize || i === words.length - 1) {
      yield buffer;
      buffer = "";
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
}
