export default class FlowcorePredicateException extends Error {
  constructor(message: string) {
    super(`Failed to check predicate: ${message}`);
    this.name = "FlowcorePredicateException";
  }
}
