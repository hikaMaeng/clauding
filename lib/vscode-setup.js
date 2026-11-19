import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVSCodeJson, vscodeModel } from './vscode.js';

/** Compile a Windows process adapter, or write a POSIX executable shim. */
export function createVSCodeWrapper(directory, { node = process.execPath,
  entry = fileURLToPath(new URL('../bin/clauding-vscode.js', import.meta.url)) } = {}) {
  mkdirSync(directory, { recursive: true });
  if (process.platform !== 'win32') {
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    const file = join(directory, 'clauding-vscode');
    writeFileSync(file, `#!/bin/sh\nexec ${quote(node)} ${quote(entry)} "$@"\n`, { mode: 0o700 });
    return file;
  }
  const escape = (value) => value.replaceAll('"', '""');
  const template = readFileSync(new URL('./vscode-wrapper.cs', import.meta.url), 'utf8');
  const source = template.replace('__CLAUDING_NODE__', escape(node)).replace('__CLAUDING_ENTRY__', escape(entry));
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  const output = join(directory, `clauding-vscode-${hash}.exe`);
  if (existsSync(output)) return output;
  const compiler = ['Framework64', 'Framework'].map((name) =>
    join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', name, 'v4.0.30319', 'csc.exe')).find(existsSync);
  if (!compiler) throw new Error('The Windows VS Code adapter needs the .NET Framework C# compiler (csc.exe).');
  const input = join(directory, `clauding-vscode-${hash}.cs`);
  writeFileSync(input, source, 'utf8');
  const result = spawnSync(compiler, ['/nologo', '/target:exe', '/optimize+', `/out:${output}`, input],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`Cannot build the VS Code adapter: ${result.error?.message || result.stdout || result.stderr}`);
  return output;
}

/** Install into the existing official VS Code extension's user settings. */
export async function setupVSCode(args, { home = homedir(), appData = process.env.APPDATA, settingsPath } = {}) {
  const off = args.length === 1 && args[0] === '--off';
  let selector;
  if (args.length && !off) {
    if (args.length !== 2 || args[0] !== '--select-model' || !args[1] || args[1].startsWith('-')) {
      throw new Error('Usage: clauding /vscode [--select-model <index|model-id>] or clauding /vscode --off');
    }
    selector = args[1];
  }
  const config = off ? null : await vscodeModel(home, selector);
  const directory = join(home, '.clauding', 'vscode');
  const settingsFile = settingsPath || (process.platform === 'win32' ? join(appData, 'Code', 'User', 'settings.json') :
    process.platform === 'darwin' ? join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json') :
      join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'Code', 'User', 'settings.json'));
  let original = existsSync(settingsFile) ? readFileSync(settingsFile) : null;
  let settings;
  try { settings = original ? JSON.parse(original.toString('utf8').replace(/^\uFEFF/, '')) : {}; }
  catch { throw new Error('VS Code settings must be valid JSON for automatic setup. No settings were changed.'); }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('VS Code user settings must be an object.');
  const registrationFile = join(directory, 'registration.json');
  const registration = readVSCodeJson(registrationFile, true);
  if (off) {
    if (!registration.previous || registration.settingsFile !== settingsFile) throw new Error('No Clauding VS Code registration was found for these settings.');
    for (const [key, value] of Object.entries(registration.installed)) {
      if (settings[key] !== value) throw new Error(`VS Code ${key} was changed after setup; restore it manually from the backup.`);
      const old = registration.previous[key];
      if (old.present) settings[key] = old.value;
      else delete settings[key];
    }
    writeFileSync(settingsFile, JSON.stringify(settings, null, 4) + '\n', { mode: 0o600 });
    console.log('Removed Clauding integration. Start a new Claude Code conversation or reload VS Code.');
    return;
  }
  const wrapper = createVSCodeWrapper(directory);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(directory, 'backups', stamp);
  mkdirSync(backup, { recursive: true });
  if (original) writeFileSync(join(backup, 'settings.json'), original, { mode: 0o600 });
  const selectionFile = join(home, '.clauding', 'vscode.json');
  const selection = readVSCodeJson(selectionFile, true);
  if (existsSync(selectionFile)) writeFileSync(join(backup, 'vscode.json'), readFileSync(selectionFile), { mode: 0o600 });
  if (selector != null) selection.modelSelector = selector;
  const installed = { 'claudeCode.claudeProcessWrapper': wrapper, 'claudeCode.disableLoginPrompt': true };
  const previous = {};
  for (const key of Object.keys(installed)) {
    previous[key] = registration.settingsFile === settingsFile && registration.previous?.[key] &&
      settings[key] === registration.installed?.[key] ? registration.previous[key] :
      Object.hasOwn(settings, key) ? { present: true, value: settings[key] } : { present: false };
  }
  Object.assign(settings, installed);
  mkdirSync(resolve(settingsFile, '..'), { recursive: true });
  writeFileSync(selectionFile, JSON.stringify(selection, null, 2) + '\n', { mode: 0o600 });
  const staged = settingsFile + '.clauding-tmp';
  writeFileSync(staged, JSON.stringify(settings, null, 4) + '\n', { mode: 0o600 });
  // Refuse to replace settings edited while the adapter was being built.
  if (original && !readFileSync(settingsFile).equals(original)) throw new Error('VS Code settings changed during setup; retry. A backup was saved.');
  renameSync(staged, settingsFile);
  writeFileSync(registrationFile, JSON.stringify({ settingsFile, previous, installed, backup }, null, 2) + '\n', { mode: 0o600 });
  console.log(`Added Clauding controls to the official VS Code Claude Code extension.\nLocal model: ${config.model.trim()}\nSettings: ${settingsFile}\nBackup: ${backup}\nOriginal connection is preserved. Without an account, Clauding starts enabled. Start a new conversation or reload the window.`);
  return { wrapper, settingsFile, backup };
}
