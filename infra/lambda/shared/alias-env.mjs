// Both aliases point at the same published version, so per-version environment
// variables cannot differ. The handler instead resolves which environment it is
// running as from its own invoked ARN and reads the matching suffixed variable.
export function aliasEnv(invokedFunctionArn) {
  if (!invokedFunctionArn) return 'DEV';
  const parts = invokedFunctionArn.split(':');
  // Unqualified: arn:aws:lambda:region:acct:function:name        (7 parts)
  // Qualified:   arn:aws:lambda:region:acct:function:name:alias  (8 parts)
  if (parts.length < 8) return 'DEV';
  const qualifier = parts[7];
  if (qualifier === 'prod') return 'PROD';
  return 'DEV';
}
