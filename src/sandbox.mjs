import { spawn } from 'node:child_process';

/** Run a shell command in a subprocess with a timeout, scoped env, and failure-as-value.
 *
 * HONEST SCOPE: this is **subprocess isolation** (timeout, caller-scoped env, non-zero exit = failure),
 * NOT a security sandbox. A true code-execution jail requires a container/VM at the execution layer —
 * which is exactly where the adversarial review says sandboxing belongs (not a false perimeter at the
 * orchestration layer). Callers must scope `env` to drop inherited secrets. */
export function runShell(cmd, { cwd, env, timeoutMs = 5000, allow } = {}) {
  return new Promise((resolve) => {
    if (allow) {
      const permitted = typeof allow === 'function' ? allow(cmd) : allow.some((p) => cmd === p || cmd.startsWith(p));
      if (!permitted) return resolve({ ok: false, error: 'disallowed by allowlist', stdout: '', stderr: '' });
    }
    const child = spawn(cmd, { cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch { /* already gone */ } }, Math.max(0, timeoutMs));

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message, stdout, stderr }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return resolve({ ok: false, error: 'timeout', stdout, stderr });
      if (code === 0) return resolve({ ok: true, value: stdout, meta: { code, stderr } });
      resolve({ ok: false, error: `exit ${code}`, stdout, stderr, code });
    });
  });
}
