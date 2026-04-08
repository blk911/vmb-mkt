import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadResolverRegistry } from "./registry-store";

const RESOLVER_RUNTIME_SUMMARY_PATH = path.join(process.cwd(), "runtime-data/resolver_runtime_summary.json");

export function runResolverWithTimeout(opts?: { timeoutMs?: number }): {
  completed: boolean;
  timedOut: boolean;
  error?: string;
  dominantSlowPhase?: string;
  operators: ReturnType<typeof loadResolverRegistry>;
} {
  const timeoutMs = Math.max(1000, Math.min(60000, opts?.timeoutMs ?? 15000));
  const childProcessTimeoutMs = timeoutMs + 3000;
  const internalBudgetMs = Math.max(2000, timeoutMs - 2000);
  const phaseBudgetMs = Math.max(1000, Math.floor(internalBudgetMs / 3));
  const bootstrap = [
    "const path=require('node:path');",
    "const fs=require('node:fs');",
    "const Module=require('node:module');",
    "const origResolve=Module._resolveFilename;",
    "Module._resolveFilename=function(request,parent,isMain,options){",
    "if(typeof request==='string' && request.startsWith('@/')){",
    "const raw=request.slice(2);",
    "const rootMapped=path.join(process.cwd(), raw);",
    "const srcMapped=path.join(process.cwd(),'src', raw);",
    "const pick=(candidate)=>fs.existsSync(candidate)||fs.existsSync(candidate+'.ts')||fs.existsSync(candidate+'.tsx')||fs.existsSync(candidate+'.js')||fs.existsSync(candidate+'.json');",
    "return origResolve.call(this, pick(rootMapped)?rootMapped:srcMapped, parent, isMain, options);",
    "}",
    "return origResolve.call(this, request, parent, isMain, options);",
    "};",
    "const { runResolver } = require('./src/lib/resolver/run-resolver');",
    `runResolver({ traceRuntime: true, safeRuntime: true, totalBudgetMs: ${internalBudgetMs}, phaseBudgetMs: ${phaseBudgetMs}, heartbeatEvery: 50 });`,
  ].join("");

  const result = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", bootstrap], {
    cwd: process.cwd(),
    timeout: childProcessTimeoutMs,
    env: {
      ...process.env,
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: "commonjs", moduleResolution: "node" }),
    },
    encoding: "utf-8",
  });

  const timedOut = Boolean(result.signal === "SIGTERM" || result.error?.name === "Error");
  const summary =
    fs.existsSync(RESOLVER_RUNTIME_SUMMARY_PATH)
      ? (JSON.parse(fs.readFileSync(RESOLVER_RUNTIME_SUMMARY_PATH, "utf-8")) as {
          completed?: boolean;
          timedOut?: boolean;
          dominantSlowPhase?: string;
          error?: string;
        })
      : undefined;
  if (result.status === 0 && summary?.completed !== false) {
    return {
      completed: true,
      timedOut: false,
      dominantSlowPhase: summary?.dominantSlowPhase,
      operators: loadResolverRegistry(),
    };
  }

  return {
    completed: summary?.completed === true,
    timedOut: summary?.timedOut === true || timedOut,
    dominantSlowPhase: summary?.dominantSlowPhase,
    error:
      summary?.error ||
      result.error?.message ||
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `resolver_exit_${result.status ?? "unknown"}`,
    operators: loadResolverRegistry(),
  };
}
