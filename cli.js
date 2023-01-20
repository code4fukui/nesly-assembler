#!/usr/bin/node

import bole from "https://code4fukui.github.io/bole/bole.js";
import { program } from 'https://code4fukui.github.io/commander-es/index.js';
import Compiler from './index.js';
import pkg from "./package.json" assert { type: "json" };

const log = bole('cli')

var compiler = new Compiler()
var version = pkg.version

/**
 * setup command line parsing
 */
program
  .version(version)
  .usage('[options]')
  .option('-i, --input-file [value]', 'Input file')
  .option('-o, --output-file', 'Output file')
  .parse()

const input = program.args[0] || program.inputFile
const code = compiler.openFile(input)
const output = program.outputFile || program.args[1] || 'out.nes'

try {
  const bin = compiler.nesCompiler(code)
  console.log("BIN", bin);
  compiler.writeFile(output, bin)
} catch (e) {
  console.log("EE", e);
  e.forEach(function (error) {
    log.error('Error: ', error)
  })
  Deno.exit(1)
}
