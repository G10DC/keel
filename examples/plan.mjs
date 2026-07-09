// Example keel plan — declarative steps. Run with: node src/cli.mjs run --plan examples/plan.mjs
export default {
  instructions: ['be concise and safe'],
  steps: [
    { id: 'seed', kind: 'literal', config: { value: 'keel' } },
    { id: 'ask', deps: ['seed'], kind: 'llm', config: { messages: [{ role: 'user', content: 'ping' }] } },
    { id: 'probe', kind: 'shell', config: { cmd: 'echo running-keel', timeoutMs: 2000 } },
  ],
};
