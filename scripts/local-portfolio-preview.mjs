import { spawn } from 'node:child_process';

const env = Object.fromEntries(['PATH', 'SystemRoot', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3197'], {
  cwd: new URL('..', import.meta.url),
  env: { ...env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill());
child.on('exit', code => process.exit(code ?? 1));
