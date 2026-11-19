#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { vscodeLaunch } from '../lib/vscode.js';
import { superviseChild } from '../lib/lifecycle.js';

try {
  const launch = await vscodeLaunch(process.argv.slice(2));
  const child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env, stdio: 'inherit', windowsHide: true });
  process.exitCode = await superviseChild(child, { terminal: false });
} catch (error) {
  console.error(`clauding-vscode: ${error.message}`);
  process.exitCode = 1;
}
