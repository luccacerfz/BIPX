// Environment for child game servers started by QA tools. Secrets must never reach them: with JEF features
// on the server, a forwarded TYPESAFE_API_KEY would make the suites call the paid API and turn
// non-deterministic; a forwarded Supabase key would write test runs into the real leaderboard.
//
// Values are BLANKED, not deleted: server.mjs `loadLocalEnv()` only fills variables that are undefined,
// so an empty string also stops the local `.env` file from re-introducing the secret.

const SECRET_NAME = /(^|_)(KEY|KEYS|SECRET|SECRETS|TOKEN|TOKENS|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS)$|^SUPABASE_|^TYPESAFE_/i;
const ALWAYS_BLANK = ['TYPESAFE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_KEY'];

export const isSecretName = (name) => SECRET_NAME.test(name);

export function sanitizedChildEnv(overrides = {}, source = process.env) {
  const env = {};
  for (const [name, value] of Object.entries(source)) env[name] = isSecretName(name) ? '' : value;
  for (const name of ALWAYS_BLANK) env[name] = '';
  return { ...env, ...overrides };
}
