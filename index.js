import bole from "https://code4fukui.github.io/bole/bole.js";
bole.output([
  { level: 'info', stream: Deno.stdout },
  { level: 'debug', stream: Deno.stdout },
  { level: 'error', stream: Deno.stdout }
])
import Compiler from "./compiler.js";
export default Compiler;
