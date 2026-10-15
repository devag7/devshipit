#!/usr/bin/env node
import { run } from "../lib/cli.mjs";

const code = await run(process.argv.slice(2), {
  fetch: globalThis.fetch,
  stdout: (t) => process.stdout.write(t + "\n"),
  stderr: (t) => process.stderr.write(t + "\n"),
  env: process.env,
});
process.exitCode = code;
