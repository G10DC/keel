/** Declarative step handlers. A step may declare { kind, config } instead of a `run` function; the
 *  dispatcher resolves kind → handler. Predictable, config-driven routing — not learned. */
import { runShell } from './sandbox.mjs';

const REGISTRY = new Map();

/** Register a handler for a step kind. */
export function registerHandler(kind, fn) { REGISTRY.set(kind, fn); }
/** Look up a handler by kind (undefined if not registered). */
export function getHandler(kind) { return REGISTRY.get(kind); }
/** Clear all handlers (test isolation). */
export function clearHandlers() { REGISTRY.clear(); }

/** Built-in handlers: `fn(config, ctx, mailbox) → { ok, value?, error?, meta? }`. */
export const builtinHandlers = {
  literal: async (cfg) => ({ ok: true, value: cfg.value }),
  llm: async (cfg, ctx) => {
    if (!ctx.provider) throw new Error('llm step requires a provider in context');
    const r = await ctx.provider.complete({ messages: cfg.messages ?? [], policy: ctx.policy });
    return { ok: true, value: r.text, meta: r.meta };
  },
  transform: async (cfg, ctx, mailbox) => ({ ok: true, value: cfg.fn(ctx, mailbox) }),
  shell: async (cfg) => runShell(cfg.cmd, { cwd: cfg.cwd, env: cfg.env, timeoutMs: cfg.timeoutMs }),
};

/** (Re)register all built-ins. Idempotent. */
export function registerBuiltins() {
  for (const [k, fn] of Object.entries(builtinHandlers)) REGISTRY.set(k, fn);
}

registerBuiltins(); // available out of the box
