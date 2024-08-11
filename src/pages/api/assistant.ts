import type { APIRoute } from 'astro'
import { Readable } from 'stream'
import OpenAI from 'openai'
import type { ThreadMessageDeltaEvent, ThreadMessageCompletedEvent } from '../../shared/types.ts'

const assistant = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
})

const extractDataToPush = ({ event, data }: OpenAI.Beta.Assistants.AssistantStreamEvent): ThreadMessageDeltaEvent | ThreadMessageCompletedEvent | undefined => {
  if (event === 'thread.message.delta' && data.delta.content) {
    const [content] = data.delta.content

    if (content?.type === 'text' && content.text?.value) {
      return {
        type: 'thread.message.delta',
        payload: content.text.value,
      }
    }
  }

  if (event === 'thread.message.completed') {
    const [content] = data.content

    if (content?.type === 'text' && content.text.value) {
      return {
        type: 'thread.message.completed',
        payload: `${content.text.value}\n`,
      }
    }
  }

  return undefined
}

// noinspection JSUnusedGlobalSymbols
export const GET: APIRoute = async () => {
  const stream = await assistant.beta.threads.createAndRun({
    // assistant_id: '',
    assistant_id: import.meta.env.OPENAI_ASSISTANT_ID,
    thread: {
      messages: [
        // TODO: chunks from the page
        {
          role: 'user',
          content:
            'Play Online Real Money Slots with Trusted Payment Methods Now that you know what it takes to get started with real money slot games, it’s time to look for reliable banking options. Here are our recommended payment methods for US players: 💡 Editor’s Choice Our team uses the e-wallet CashApp to deposit and withdraw through Bitcoin. It’s our #1 pick because: Many US slots sites support Cash App transactions You can quickly deposit and withdraw using the same method The app has an in-built cryptocurrency exchange doesn\'t charge any hidden or extra payment fees',
        },
        // {
        //   role: "user",
        //   content:
        //     "Here’s How You Can Gamble Responsibly It’s easy to lose track of your time and money when you’re having fun playing online, and nobody wants that. To get the most out of real money slots, check out our advice on responsible gambling here: 1 Stick to a budget Plan how much cash you can spend before playing real money slots online. Decide how much money you’re willing to bet and set yourself daily, weekly, or monthly limits. This way you’ll be betting only on what you can afford to lose. 2 Don’t chase your losses Don’t believe in the myth of betting bigger to recoup losses. There’s a good chance you’ll deplete even more of your hard-earned cash. Whether you’ve landed a decent payout or lost your deposit, call it a day when you’ve reached your budget. 3 Not in the best mood? Then take a rain check You’ll likely end up making poor decisions and overspending if you’re feeling down, angry, or tired. Being under the influence of alcohol will also impair your ability to play smart. 4 Many sites offer responsible gambling tools, so take advantage of them The leading slots sites on VSO offer self-exclusion and time out tools. The ones we find most helpful include wagering limits, session limits, and loss limits. 5 Don’t feel ashamed to ask for help We’re all human, and it’s okay to accept help when we need it. There are several organizations that will support you if gambling has become an issue for you.",
        // },
        // {
        //   role: "user",
        //   content:
        //     "Top Progressive Jackpot Slots to Spin in 2024 Progressive jackpots are popular among slots players because of the potential for big wins. In progressive slots, multiple players contribute to the jackpot for a selected game. Whenever a player spins the reels, a percentage of their bet goes towards the jackpot prize pool. The winnings are huge because the longer it takes for someone to win, the bigger the amount gets. Also, when someone does win the jackpot, the number does not reset to 0 - it restarts from a predetermined amount, usually 1 million. Check out our list of the most renown progressive slots below, which you can play for real at our best slot sites:",
        // },
      ],
    },
    stream: true,
  })

  const [firstStream] = stream.tee()

  const readable = new Readable({
    async read() {
      try {
        for await (const chunk of firstStream) {
          const dataToPush = extractDataToPush(chunk)

          if (dataToPush) {
            this.push(`data: ${JSON.stringify(dataToPush)}\n\n`)
          }
        }
      } catch (error) {
        console.error('Stream error', error)
      } finally {
        // If you want to close the SSE connection when all data is processed,
        // uncomment the line below
        // this.push(null)
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
  })

  const readableStream = new ReadableStream({
    start(controller) {
      const heartbeatInterval = setInterval(() => {
        if (!controller.desiredSize) {
          return
        }

        try {
          controller.enqueue(': heartbeat\n\n')
        } catch (error) {
          console.error('Heartbeat error:', error)
          clearInterval(heartbeatInterval)
          controller.error(error)
        }
      }, 15_000)

      const onData = (chunk: unknown) => {
        try {
          controller.enqueue(chunk)
        } catch (error) {
          console.error('Error enqueueing chunk:', error)
          readable.removeListener('data', onData)
          clearInterval(heartbeatInterval)
        }
      }

      readable.on('data', onData)

      readable.on('end', () => {
        clearInterval(heartbeatInterval)
        controller.close()
      })

      readable.on('error', (err) => {
        clearInterval(heartbeatInterval)
        controller.error(err)
      })

      readable.on('close', () => {
        if (controller.desiredSize === null) {
          clearInterval(heartbeatInterval)
          controller.close()
        }
      })
    },

    cancel(reason) {
      console.log('Stream cancelled:', reason)
      readable.destroy()
    },
  })

  return new Response(readableStream, {
    headers: {
      Connection: 'keep-alive',
      'Content-Encoding': 'none',
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  })
}
