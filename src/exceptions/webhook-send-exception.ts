export default class FlowcoreWebhookSendException extends Error {
  constructor(message: string) {
    super(`Failed to send webhook: ${message}`);
    this.name = "FlowcoreWebhookSendException";
  }
}
