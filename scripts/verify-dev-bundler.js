// scripts/verify-dev-bundler.js
// Enforces webpack AND clears port 3001 before boot (Windows-safe)

const { execSync } = require("child_process");

const script = process.env.npm_lifecycle_script || "";
if (!script.includes("--webpack")) {
  console.error("\nERROR: Dev must run with Webpack.\n");
  process.exit(1);
}

// Kill anything on port 3001 (ignore errors)
try {
  execSync(
    'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3001\') do taskkill /PID %a /F',
    { stdio: "ignore", shell: "cmd.exe" }
  );
} catch {}

console.log("✓ Dev environment clean. Starting server...");
