import { constants } from 'node:os';

/** Wait for the child, forwarding shutdown signals and enforcing a grace period. */
export function superviseChild(child, { parent = process, terminal = Boolean(process.stdin.isTTY),
  graceMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    let stopping = false;
    const handlers = new Map();
    const clean = () => {
      clearTimeout(timer);
      for (const [signal, handler] of handlers) parent.removeListener(signal, handler);
      child.removeListener('error', failed);
      child.removeListener('exit', exited);
    };
    const kill = (signal) => {
      try {
        child.kill(signal);
      } catch (error) {
        if (error.code !== 'ESRCH') parent.stderr.write(`clauding: Could not forward ${signal} to Claude Code.\n`);
      }
    };
    const shutdown = (signal) => {
      // The shared foreground console already delivers Ctrl+C to the child.
      if (signal === 'SIGINT' && terminal) return;
      if (stopping) {
        kill('SIGKILL');
        return;
      }
      stopping = true;
      kill(signal);
      timer = setTimeout(() => kill('SIGKILL'), graceMs);
    };
    const failed = (error) => {
      clean();
      reject(error);
    };
    const exited = (code, signal) => {
      clean();
      resolve(code ?? 128 + (constants.signals[signal] ?? 1));
    };
    for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) {
      const handler = () => shutdown(signal);
      handlers.set(signal, handler);
      parent.on(signal, handler);
    }
    child.once('error', failed);
    child.once('exit', exited);
  });
}
