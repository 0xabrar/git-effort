#!/usr/bin/env node
import { register } from 'node:module';
register('tsx/esm', import.meta.url);
const { main } = await import('../src/cli.ts');
main();
