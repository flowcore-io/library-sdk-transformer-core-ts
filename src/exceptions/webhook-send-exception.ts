export default class FlowcoreWebhookSendException extends Error {
  public originalError: unknown
  public flowType: string
  public eventType: string
  public event: unknown

  constructor(message: string, error: unknown, flowType: string, eventType: string, event: unknown) {
    super(`Failed to send webhook: ${message}`);
    this.originalError = error
    this.flowType = flowType
    this.eventType = eventType
    this.event = event
    this.name = "FlowcoreWebhookSendException";
  }
}
