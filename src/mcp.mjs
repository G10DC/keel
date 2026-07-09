import { run } from './dispatcher.mjs';
import { mockProvider } from './provider.mjs';
import { createPolicy, AuditLog, separateInstructionData } from './trust.mjs';

const VERSION = '0.3.0';

/** JSON-RPC method handlers. All reuse the core — no duplicated logic. `runImpl`/`providerFactory`
 *  injectable for tests. The MCP surface exposes the declarative subset (functions cannot cross JSON). */
export function mcpMethods({ runImpl = run, providerFactory = mockProvider, version = VERSION } = {}) {
  return {
    initialize: async () => ({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'keel', version },
    }),
    'tools/list': async () => ({
      tools: [
        { name: 'keel_run', description: 'Run a keel plan (declarative steps with deps).', inputSchema: { type: 'object', properties: { steps: { type: 'array' }, instructions: { type: 'array' } } } },
        { name: 'keel_separate', description: 'Split messages into instructions vs data (the trust boundary).', inputSchema: { type: 'object', properties: { messages: { type: 'array' } } } },
      ],
    }),
    'tools/call': async ({ params }) => {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name === 'keel_run') {
        const audit = new AuditLog();
        const policy = createPolicy({ instructions: args.instructions ?? [] });
        const res = await runImpl(args.steps ?? [], { policy, audit, provider: providerFactory() });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: res.ok, failed: res.failed, auditOk: audit.verify() }) }] };
      }
      if (name === 'keel_separate') {
        const { instructions, data } = separateInstructionData(args.messages ?? []);
        return { content: [{ type: 'text', text: JSON.stringify({ instructions: instructions.length, data: data.length }) }] };
      }
      throw new Error(`unknown tool: ${name}`);
    },
  };
}

/** Minimal JSON-RPC 2.0 dispatch over line-delimited stdio. `input` is an async iterable of lines,
 *  `output` has a `write(string)` method. Injectable transports → fully testable offline. */
export async function serve({ input, output, methods = mcpMethods() }) {
  const send = (obj) => output.write(JSON.stringify(obj) + '\n');
  for await (const line of input) {
    let msg;
    try { msg = JSON.parse(String(line)); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
    const handler = methods[msg.method];
    if (!handler) { send({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: 'method not found' } }); continue; }
    try {
      const result = await handler(msg);
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, result });
    } catch (e) {
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: e?.message ?? String(e) } });
    }
  }
}
