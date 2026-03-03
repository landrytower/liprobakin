import { Sandbox } from "@vercel/sandbox";

let sandbox;

try {
  sandbox = await Sandbox.create();
  const cmd = await sandbox.runCommand("echo", ["Hello from Vercel Sandbox!"]);
  console.log(await cmd.stdout());
} catch (error) {
  console.error("Failed to create Vercel Sandbox.");
  console.error("If you see 403/Not authorized, refresh your Vercel auth:");
  console.error("1) Run: vercel login");
  console.error("2) Or export a valid VERCEL_TOKEN before running this script.");
  console.error("3) Re-run: npm run sandbox:hello");
  process.exitCode = 1;
} finally {
  if (sandbox) {
    await sandbox.stop();
  }
}
