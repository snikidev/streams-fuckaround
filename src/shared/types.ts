export type ThreadMessageDeltaEvent = {
  type: 'thread.message.delta'
  payload: string
}

export type ThreadMessageCompletedEvent = {
  type: 'thread.message.completed'
  payload: string
}
