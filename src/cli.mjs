// keel CLI — `keel run --plan <plan.mjs>` runs a plan; `keel mcp` serves the MCP stdio surface.
import { pathToFileURL } from 'node:url';
import * as readline from 'node:readline';
import { run } from './dispatcher.mjs';
import { mockProvider } from './provider.mjs';
import { createPolicy, AuditLog } from './trust.mjs';
import { serve, mcpMethods } from './mcp.mjs';

export async function main(argv = process.argv.slice(2)) {
  if (argv[0] === 'mcp') {
    const rl = readline.createInterface({ input: process.stdin });
    await serve({ input: rl, output: process.stdout, methods: mcpMethods() });
    rl.close();
    return 0;
  }

  const i = argv.indexOf('--plan');
  const file = i >= 0 ? argv[i + 1] : null;
  if (!file) { console.error('usage: keel run --plan <plan.mjs> | keel mcp'); return 2; }

  const imported = await import(pathToFileURL(file).href);
  const plan = imported.default ?? imported;
  const audit = new AuditLog();
  const policy = createPolicy({ instructions: plan.instructions ?? [] });
  const provider = mockProvider();

  audit.append({ type: 'plan.start', payload: { steps: plan.steps.map((s) => s.id) } });
  const res = await run(plan.steps, { policy, audit, provider });
  audit.append({ type: 'plan.end', payload: { ok: res.ok, failed: res.failed } });

  console.log(JSON.stringify({
    ok: res.ok,
    failed: res.failed,
    results: [...res.results.entries()].map(([id, r]) => ({ id, ...r })),
    auditOk: audit.verify(),
  }, null, 2));
  return res.ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('cli.mjs')) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(1); });
}
