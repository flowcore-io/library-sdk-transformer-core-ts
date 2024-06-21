export default class FlowcorePredicateException extends Error {
  public originalError: unknown
  public eventId: string
  public flowType: string
  public eventType: string
  public event: unknown
  constructor(
    message: string,
    error: unknown,
    eventId: string,
    flowType: string,
    eventType: string,
    event: unknown,
  ) {
    super(`Failed to check predicate: ${message}`)
    this.originalError = error
    this.eventId = eventId
    this.flowType = flowType
    this.eventType = eventType
    this.event = event
    this.name = "FlowcorePredicateException"
  }
}
