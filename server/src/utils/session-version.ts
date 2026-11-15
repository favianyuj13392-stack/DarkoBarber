/**
 * A JWT is only valid while its `tv` claim equals the account's current
 * `tokenVersion`. Tokens issued before the claim existed have no `tv` and
 * count as version 0, which matches every account that never changed password.
 */
export function isSessionCurrent(tokenTv: number | undefined, accountVersion: number): boolean {
  return (tokenTv ?? 0) === accountVersion;
}
