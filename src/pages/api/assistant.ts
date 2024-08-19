import type { APIRoute } from "astro";
import { Readable } from "stream";
import OpenAI from "openai";
import type {
  ThreadMessageDeltaEvent,
  ThreadMessageCompletedEvent,
} from "../../shared/types.ts";

const assistant = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

const extractDataToPush = ({
  event,
  data,
}: OpenAI.Beta.Assistants.AssistantStreamEvent):
  | ThreadMessageDeltaEvent
  | ThreadMessageCompletedEvent
  | undefined => {
  if (event === "thread.message.delta" && data.delta.content) {
    const [content] = data.delta.content;

    if (content?.type === "text" && content.text?.value) {
      return {
        type: "thread.message.delta",
        payload: content.text.value,
      };
    }
  }

  if (event === "thread.message.completed") {
    const [content] = data.content;

    if (content?.type === "text" && content.text.value) {
      return {
        type: "thread.message.completed",
        payload: `${content.text.value}\n`,
      };
    }
  }

  return undefined;
};

// noinspection JSUnusedGlobalSymbols
export const GET: APIRoute = async () => {
  const stream = await assistant.beta.threads.createAndRun({
    assistant_id: import.meta.env.OPENAI_ASSISTANT_ID,
    thread: {
      messages: [
        {
          role: "user",
          content:
            "Play Online Real Money Slots with Trusted Payment Methods Now that you know what it takes to get started with real money slot games, it’s time to look for reliable banking options. Here are our recommended payment methods for US players: 💡 Editor’s Choice Our team uses the e-wallet CashApp to deposit and withdraw through Bitcoin. It’s our #1 pick because: Many US slots sites support Cash App transactions You can quickly deposit and withdraw using the same method The app has an in-built cryptocurrency exchange doesn't charge any hidden or extra payment fees",
        },
      ],
    },
    stream: true,
  });

  const [firstStream] = stream.tee();

  const readable = new Readable({
    async read() {
      try {
        for await (const chunk of firstStream) {
          const dataToPush = extractDataToPush(chunk);

          if (dataToPush) {
            this.push(`data: ${JSON.stringify(dataToPush)}\n\n`);
          }
        }
      } catch (error) {
        console.error("Stream error", error);
      } finally {
        // Close the SSE connection when all data is processed
        this.push(null);
      }

      // If you want to play around with the data as reader objects,
      // you can uncomment the snippet below
      // const reader = firstStream.toReadableStream().getReader()
      // const decoder = new TextDecoder()
      //
      // try {
      //   while (true) {
      //     const { done, value } = await reader.read()
      //
      //     if (done) {
      //       break
      //     }
      //
      //     // `value` is `Uint8Array`
      //     const text = decoder.decode(value)
      //
      //     if (text) {
      //       this.push(text)
      //     }
      //   }
      // } catch (error) {
      //   console.error('Stream error', error)
      // } finally {
      //   // If you want to close the SSE connection when all data is processed,
      //   // uncomment the line below
      //   this.push(null)
      // }
    },
  });

  const readableStream = new ReadableStream({
    start(controller) {
      const heartbeatInterval = setInterval(() => {
        if (!controller.desiredSize) {
          return;
        }

        try {
          controller.enqueue(": heartbeat\n\n");
        } catch (error) {
          console.error("Heartbeat error:", error);
          clearInterval(heartbeatInterval);
          controller.error(error);
        }
      }, 15_000);

      const onData = (chunk: unknown) => {
        try {
          controller.enqueue(chunk);
        } catch (error) {
          console.error("Error enqueueing chunk:", error);
          readable.removeListener("data", onData);
          clearInterval(heartbeatInterval);
        }
      };

      readable.on("data", onData);

      readable.on("end", () => {
        clearInterval(heartbeatInterval);
        controller.close();
      });

      readable.on("error", (err) => {
        clearInterval(heartbeatInterval);
        controller.error(err);
      });

      readable.on("close", () => {
        if (controller.desiredSize === null) {
          clearInterval(heartbeatInterval);
          controller.close();
        }
      });
    },

    cancel(reason) {
      console.log("Stream cancelled:", reason);
      readable.destroy();
    },
  });

  return new Response(readableStream, {
    headers: {
      Connection: "keep-alive",
      "Content-Encoding": "none",
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
};
