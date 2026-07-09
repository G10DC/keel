// Example keel plan. Run with: node src/cli.mjs run --plan examples/plan.mjs
export default {
  instructions: ['be concise and safe'],
  steps: [
    {
      id: 'ask',
      run: async (ctx) => {
        const r = await ctx.provider.complete({ messages: [{ role: 'user', content: 'ping' }] });
        ctx.mailbox.set('reply', r.text);
        return { ok: true, value: r.text };
      },
    },
    {
      id: 'echo',
      deps: ['ask'],
      run: (ctx) => ({ ok: true, value: `reply was: ${ctx.mailbox.get('reply')}` }),
    },
  ],
};
