import type { VerifiedProviderIdentity } from "../domain/identity.types";

export abstract class ProviderAuthenticationPort {
  abstract authenticate(input: {
    username: string;
    password: string;
  }): Promise<VerifiedProviderIdentity>;
}
