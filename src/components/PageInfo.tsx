import { useEffect, useState, startTransition } from 'react'
import type { ThreadMessageDeltaEvent, ThreadMessageCompletedEvent } from '../shared/types.ts'

const checkIsObjectLike = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null
}

const checkIsTheadMessageDeltaEvent = (eventData: object): eventData is ThreadMessageDeltaEvent => {
  return 'type' in eventData && eventData.type === 'thread.message.delta'
}

const checkIsThreadMessageCompletedEvent = (eventData: object): eventData is ThreadMessageCompletedEvent => {
  return 'type' in eventData && eventData.type === 'thread.message.completed'
}

export const PageInfo = () => {
  const [text, setText] = useState('')

  useEffect(() => {
    const eventSource = new EventSource('/api/assistant')

    eventSource.addEventListener('open', event => {
      console.log('open', event)
    })

    eventSource.addEventListener('message', event => {
      console.log('message', event)

      try {
        const eventData = JSON.parse(event.data)

        if (!checkIsObjectLike(eventData)) {
          return
        }

        if (checkIsTheadMessageDeltaEvent(eventData)) {
          startTransition(() => {
            setText(prevState => `${prevState}${eventData.payload}`)
          })

          return
        }

        if (checkIsThreadMessageCompletedEvent(eventData)) {
          setText(eventData.payload)
        }
      } catch (error) {
        console.error(error)
      }
    })

    eventSource.addEventListener('error', event => {
      console.log('error', event)
      eventSource.close()
    })

    return () => {
      // Event cleanup happens automatically
      eventSource.close()
    }
  }, [])

  return (
    <pre style={{
      backgroundColor: '#f4f4f9',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      color: '#333',
      fontFamily: '\'Courier New\', Courier, monospace',
      fontSize: '1rem',
      maxWidth: '100%',
      overflowX: 'auto',
      padding: '16px',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    }}>
      {text}
    </pre>
  )
}
