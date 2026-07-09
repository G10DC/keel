import { separateInstructionData } from './trust.mjs';

/** Autonomous agent loop (ReAct-style): the model drives. It may call tools — executed through the
 *  trust boundary (instruction/data separation, provenance, audit, scoped credentials) — until it
 *  returns a final answer or hits maxIter. Failure-as-value throughout (unknown/throwing tool →
 *  recorded failure, loop continues). */
export async function loop({ provider, tools = {}, messages = [], policy, audit, maxIter = 8, credTools = [] }) {
  const conv = [...messages];
  for (let i = 0; i < maxIter; i += 1) {
    if (audit) audit.append({ type: 'agent.iter', payload: { iter: i }, provenance: { source: 'agent' } });
    const { instructions, data } = separateInstructionData(conv);
    const r = await provider.complete({ messages: conv, policy, instructions, data });
    if (!r.tool_calls || r.tool_calls.length === 0) {
      if (audit) audit.append({ type: 'agent.final', payload: { iters: i + 1 }, provenance: { source: 'agent' } });
      return { ok: true, value: r.text, iters: i + 1 };
    }
    conv.push({ role: 'assistant', content: r.text ?? '', tool_calls: r.tool_calls });
    for (const tc of r.tool_calls) {
      const tool = tools[tc.name];
      let result;
      if (!tool) {
        result = { ok: false, error: `unknown tool: ${tc.name}` };
      } else {
        try {
          const v = await tool.run(tc.args ?? {}, { policy, audit, creds: credTools.includes(tc.name) ? policy?.creds : undefined });
          result = { ok: true, value: v };
        } catch (e) {
          result = { ok: false, error: e?.message ?? String(e) };
        }
      }
      if (audit) audit.append({ type: 'tool.call', payload: { name: tc.name, ok: result.ok }, provenance: { source: `tool:${tc.name}` } });
      conv.push({ role: 'tool', name: tc.name, content: JSON.stringify(result) });
    }
  }
  return { ok: false, error: 'max iterations reached', iters: maxIter };
}
