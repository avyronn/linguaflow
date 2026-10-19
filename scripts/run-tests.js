#!/usr/bin/env node
/* Runs every *.test.js file under tests/ with Node's built-in runner. Works on Node >= 18 (does not rely on glob support in `node --test`). */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..', 'tests');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.test.js')) files.push(p); } })(root);
files.sort();
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
