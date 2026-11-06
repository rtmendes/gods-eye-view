import { spawn } from 'node:child_process';
// One sequential import per hour. The supervisor owns this process's lifetime.
let child,
  timer,
  stopping = false;
function refresh() {
  if (stopping) return;
  child = spawn(
    process.execPath,
    [
      '--use-env-proxy',
      new URL('./refresh.mjs', import.meta.url).pathname,
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit' },
  );
  child.on('error', (error) =>
    console.error('[enforcement watcher]', error.message),
  );
  child.on('close', (code) => {
    child = null;
    if (code)
      console.error(
        '[enforcement watcher] Import failed; retaining accepted data until next attempt.',
      );
    if (!stopping) timer = setTimeout(refresh, 3600000);
  });
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    clearTimeout(timer);
    child?.kill(signal);
  });
refresh();
