import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const syncScript = fileURLToPath(new URL('./syncBlockchain.js', import.meta.url));
const intervalMs = 30_000;

function runSync() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [syncScript], { stdio: 'inherit' });
    child.once('close', resolve);
    child.once('error', error => {
      console.error('Could not start blockchain sync:', error.message);
      resolve(1);
    });
  });
}

console.log('Running blockchain sync every 30 seconds. Press Ctrl+C to stop.');
while (true) {
  const startedAt = Date.now();
  if (await runSync() !== 0) console.error('Blockchain sync failed. The next cycle will retry.');
  await delay(Math.max(1000, intervalMs - (Date.now() - startedAt)));
}
