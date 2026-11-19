let active = false;
const turns = new Set();
let switching = false;
let entries = [];
let selected = 0;
let original = {};
let error = '';
let openingTimer;

function endpoint(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw Error('Unsupported model endpoint.');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.search || url.hash ? url.toString() : url.toString().replace(/\/$/, '');
}

/** Read connection entries without modifying the shared configuration. */
async function loadConfiguration($, initial = false) {
  const path = await $.env.get('CLAUDING_CONFIG_PATH');
  if (!path) throw Error('Clauding configuration path is missing. Run clauding /vscode again.');
  const raw = await $.fs.read(path);
  const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const models = Object.hasOwn(data, 'models') ? data.models : [data];
  if (!Array.isArray(models) || !models.length) throw Error('Configure at least one model in .clauding/config.json.');
  for (const item of models) {
    if (!item || typeof item.baseUrl !== 'string' || !URL.canParse(item.baseUrl) ||
        !['http:', 'https:'].includes(new URL(item.baseUrl).protocol) || typeof item.model !== 'string' || !item.model.trim() ||
        item.contextTokens != null && (!Number.isSafeInteger(item.contextTokens) || item.contextTokens < 1) ||
        item.authToken != null && typeof item.authToken !== 'string') throw Error('Invalid model entry in .clauding/config.json.');
  }
  entries = models;
  const selector = await $.env.get('CLAUDING_VSCODE_SELECTOR');
  if (initial && selector) {
    const found = /^\d+$/.test(selector) ? Number(selector) - 1 : entries.findIndex(x => x.model.trim() === selector);
    if (found < 0 || found >= entries.length) throw Error('The saved VS Code model selection no longer exists.');
    selected = found;
  }
  if (selected >= entries.length) selected = 0;
}

/** Change this Claude process only; saved account credentials remain untouched. */
async function applyEnvironment($, local) {
  const item = entries[selected];
  const check = result => { if (result?.deny) throw Error(result.deny); };
  // Guard fallbacks while changing hosts. Prompts are blocked until the transition finishes.
  check(await $.env.set('ANTHROPIC_AUTH_TOKEN', 'clauding-switch-in-progress'));
  if (!local) check(await $.env.set('ANTHROPIC_BASE_URL', original.ANTHROPIC_BASE_URL));
  // Mod declarations require literal variable names at each $.env call.
  check(await $.env.set('ANTHROPIC_API_KEY', local ? undefined : original.ANTHROPIC_API_KEY));
  check(await $.env.set('ANTHROPIC_CUSTOM_HEADERS', local ? undefined : original.ANTHROPIC_CUSTOM_HEADERS));
  check(await $.env.set('CLAUDE_CODE_OAUTH_TOKEN', local ? undefined : original.CLAUDE_CODE_OAUTH_TOKEN));
  check(await $.env.set('CLAUDE_CODE_USE_BEDROCK', local ? undefined : original.CLAUDE_CODE_USE_BEDROCK));
  check(await $.env.set('CLAUDE_CODE_USE_VERTEX', local ? undefined : original.CLAUDE_CODE_USE_VERTEX));
  check(await $.env.set('CLAUDE_CODE_USE_FOUNDRY', local ? undefined : original.CLAUDE_CODE_USE_FOUNDRY));
  check(await $.env.set('CLAUDE_CODE_MAX_CONTEXT_TOKENS', local ? item.contextTokens?.toString() : original.CLAUDE_CODE_MAX_CONTEXT_TOKENS));
  check(await $.env.set('CLAUDE_CODE_ATTRIBUTION_HEADER', local ? '0' : original.CLAUDE_CODE_ATTRIBUTION_HEADER));
  check(await $.env.set('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', local ? '1' : original.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC));
  if (local) check(await $.env.set('ANTHROPIC_BASE_URL', endpoint(item.baseUrl)));
  check(await $.env.set('ANTHROPIC_AUTH_TOKEN', local ? item.authToken?.trim() || 'lmstudio' : original.ANTHROPIC_AUTH_TOKEN));
}

/** Toggle only between turns, so in-flight requests keep their connection. */
async function switchMode($, value) {
  if (turns.size || switching) { $.ui.log('Wait for the current operation before switching Clauding.'); return; }
  switching = true;
  try {
    if (value) await loadConfiguration($);
    await applyEnvironment($, value);
    active = value;
    error = '';
  } catch {
    error = 'Cannot apply the connection. Check config.json and local policy; no prompt will be sent.';
  } finally {
    switching = false;
  }
  $.ui.invalidate('ui.render');
}

/** VS Code attaches its Mod surface after the SDK starts the session. */
async function openControls($) {
  if (!(await $.session.surfaces()).includes('vscode')) return false;
  const opened = await $.ui.open({ id: 'clauding', title: 'Clauding', rows: 3 });
  return opened.isPlaced;
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    const snapshot = await $.env.get('CLAUDING_VSCODE_ORIGINAL_ENV');
    original = JSON.parse(snapshot || '{}');
    await $.command.register({ name: 'clauding', description: 'Show Clauding connection controls', argumentHint: '[on|off]', immediate: true });
    try {
      await loadConfiguration($, true);
      // The wrapper already applied the local connection for account-less starts.
      active = await $.env.get('CLAUDING_VSCODE_NO_ACCOUNT') === '1';
      if (await $.env.get('CLAUDING_VSCODE_AUTH_UNKNOWN') === '1') {
        $.ui.log('Claude account check did not finish. Select Clauding ON to use the local connection.');
      }
    } catch {
      $.ui.log('Clauding could not read its model configuration. Fix config.json and run /clauding on.');
    }
    if (await $.env.get('CLAUDE_CODE_ENTRYPOINT') === 'claude-vscode' && !await openControls($)) {
      let attempts = 0;
      openingTimer = $.clock.every(250, async () => {
        if (await openControls($) || ++attempts >= 80) openingTimer?.cancel();
      });
    }
    return next(e);
  });
  on('command.run', { command: 'clauding' }, async ($, e) => {
    if (e.args.trim() === 'on') await switchMode($, true);
    else if (e.args.trim() === 'off') await switchMode($, false);
    await openControls($);
    return { text: error || (active ? `Clauding ON (${entries[selected].model})` : 'Clauding OFF (original connection)') };
  });
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'clauding') return next(e);
    const { Box, Text, Button, Select } = $.ui.resolve(e);
    return Box({ flexDirection: 'column', children: [
      Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'toggle', label: active ? 'Clauding ON' : 'Clauding OFF', onPress: () => switchMode($, !active) }),
        Text({ children: [active ? entries[selected]?.model || '' : 'Original Claude connection'] }),
      ] }),
      ...(entries.length > 1 ? [Select({ key: 'model', label: 'Clauding model', value: String(selected), options: entries.map((x,i) => ({ value: String(i), label: x.model })), onSelect: async value => {
        if (turns.size || switching) return;
        selected = Number(value);
        if (active) await switchMode($, true);
        $.ui.invalidate('ui.render');
      } })] : []),
      ...(error ? [Text({ children: [error] })] : []),
    ] });
  });
  on('prompt.submit', async ($, e, next) => {
    if (switching) return { drop: 'Wait for Clauding to finish switching connections.' };
    return error ? { drop: error } : next(e);
  })
    .catch(() => ({ drop: 'Clauding could not validate the connection. Nothing was sent.' }));
  on('turn.start', async ($, e, next) => { turns.add(e.turnId); return next(e); });
  on('turn.complete', async ($, e, next) => { turns.delete(e.turnId); $.ui.invalidate('ui.render'); return next(e); });
  on('turn.step', async function* ($, e, next) {
    return yield* next(active ? { ...e, model: entries[selected].model.trim() } : e);
  });
}
