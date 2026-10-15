export class IdentityError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
