#!/usr/bin/env node
/* Syntax check without executing anything: compiles every .js file with V8 and parses every .json file. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);
let files = 0, failures = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const rel = path.relative(ROOT, p);
    try {
      if (e.name.endsWith('.js')) { new vm.Script(fs.readFileSync(p, 'utf8').replace(/^#!.*/, ''), { filename: rel }); files++; }
      else if (e.name.endsWith('.json')) { JSON.parse(fs.readFileSync(p, 'utf8')); files++; }
    } catch (err) { failures++; console.error('✖ ' + rel + ': ' + err.message); }
  }
}
walk(ROOT);
console.log(failures ? `✖ ${failures} file(s) with syntax errors` : `✔ syntax OK (${files} .js/.json files)`);
process.exit(failures ? 1 : 0);
