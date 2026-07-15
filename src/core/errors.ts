export class IntentValidationError extends Error {
  constructor(message: string, public readonly issues?: any[]) {
    super(message);
    this.name = 'IntentValidationError';
  }
}
