// Install only the fixed tgz into fresh consumers outside both checkouts.
import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, resolve, sep } from "node:path"
import { createRequire } from "node:module"
import { spawn, spawnSync } from "node:child_process"

const [tgz, source, output] = process.argv.slice(2)
const name = "@flowcore/sdk-transformer-core"
const integrity = `sha512-${createHash("sha512").update(readFileSync(tgz)).digest("base64")}`
function check(value, code) {
  if (!value) throw new Error(`RELEASE_PROOF_${code}`)
}
function run(binary, args, cwd, extra = {}) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
    ...extra,
  })
  check(!result.error && result.status === 0, "COMMAND")
  return `${result.stdout || ""}${result.stderr || ""}`
}
async function main() {
  const node18 = process.env.NODE18_BIN
  const node24 = process.execPath
  const bun = process.env.BUN_BIN
  check(isAbsolute(node18 || "") && isAbsolute(bun || "") && isAbsolute(process.env.NPM_CLI || ""), "RUNTIME_PATH")
  const runtimes = {
    node18: run(node18, ["--version"], tmpdir()).trim(),
    node24: process.version,
    bun: run(bun, ["--version"], tmpdir()).trim(),
  }
  check(
    JSON.stringify(runtimes) === JSON.stringify({ node18: "v18.12.1", node24: "v24.15.0", bun: "1.4.4" }),
    "RUNTIME_VERSION",
  )
  const consumers = []
  for (const [runtime, binary] of [
    ["node18", node18],
    ["node24", node24],
  ]) {
    const consumer = realpathSync(mkdtempSync(resolve(tmpdir(), "sdk-installed-")))
    check(!consumer.startsWith(`${realpathSync(source)}${sep}`), "ISOLATION")
    writeFileSync(
      resolve(consumer, "package.json"),
      JSON.stringify({
        name: "isolated-sdk-proof",
        private: true,
        version: "1.0.0",
        main: `node_modules/${name}/dist/index.js`,
        types: `node_modules/${name}/dist/index.d.ts`,
      }),
    )
    // npm runs with the exact release Node, independently of the consumer runtime.
    run(
      node24,
      [
        process.env.NPM_CLI,
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--registry=https://registry.npmjs.org",
        "--save-exact",
        tgz,
      ],
      consumer,
    )
    const lock = JSON.parse(readFileSync(resolve(consumer, "package-lock.json")))
    const entry = lock.packages[`node_modules/${name}`]
    check(entry?.integrity === integrity && !entry.link && entry.resolved?.startsWith("file:"), "LOCK")
    const req = createRequire(resolve(consumer, "package.json"))
    const installed = realpathSync(req.resolve(name))
    const expected = realpathSync(resolve(consumer, "node_modules", name, "dist/index.js"))
    check(installed === expected && installed.startsWith(`${consumer}${sep}node_modules${sep}`), "RESOLUTION")
    const manifest = JSON.parse(readFileSync(resolve(consumer, "node_modules", name, "package.json")))
    check(
      manifest.name === name && manifest.main === "dist/index.js" && manifest.types === "./dist/index.d.ts",
      "EXPORTS",
    )
    // The existing tests' relative public-root import resolves to the installed export.
    // No workspace link, resolver patch or application module is introduced.
    check(realpathSync(req.resolve(consumer)) === installed, "ROOT_RESOLUTION")
    cpSync(resolve(source, "test"), resolve(consumer, "test"), { recursive: true })
    writeFileSync(
      resolve(consumer, "jest.config.cjs"),
      `module.exports = ${JSON.stringify({ rootDir: consumer, testEnvironment: "node", testTimeout: 5000, testRegex: "test/cancellation\\.spec\\.ts$", transform: { "^.+\\.(t|j)s?$": [resolve(source, "node_modules/@swc/jest"), { sourceMaps: "inline" }] }, reporters: ["default"] })}`,
    )
    run(
      binary,
      [
        resolve(source, "node_modules/typescript/bin/tsc"),
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "es2020",
        "--module",
        "commonjs",
        "--typeRoots",
        resolve(source, "node_modules/@types"),
        "test/types/cancellation.ts",
      ],
      consumer,
    )
    const results = resolve(consumer, "results.json")
    run(
      binary,
      [
        resolve(source, "node_modules/jest/bin/jest.js"),
        "--config",
        resolve(consumer, "jest.config.cjs"),
        "--runInBand",
        "--no-cache",
        "--json",
        "--outputFile",
        results,
      ],
      consumer,
    )
    const report = JSON.parse(readFileSync(results))
    check(
      report.success === true &&
        report.numPassedTests === 29 &&
        report.numFailedTests === 0 &&
        report.numPendingTests === 0,
      "BOUNDARY_CASES",
    )
    consumers.push({
      runtime,
      directory: consumer,
      installed,
      integrity,
      version: manifest.version,
      lockSha256: createHash("sha256")
        .update(readFileSync(resolve(consumer, "package-lock.json")))
        .digest("hex"),
      cases: report.numPassedTests,
    })
  }
  const consumer = consumers[1].directory
  // Transpile the already-established fixture, never SDK source or a new server.
  const swc = createRequire(resolve(source, "package.json"))(resolve(source, "node_modules/@swc/core"))
  const fixtureFile = resolve(consumer, "fixture.cjs")
  writeFileSync(
    fixtureFile,
    swc.transformSync(readFileSync(resolve(source, "test/helpers/webhook.fixture.ts"), "utf8"), {
      jsc: { parser: { syntax: "typescript" }, target: "es2020" },
      module: { type: "commonjs" },
    }).code,
  )
  const { WebhookTestFixture, deferred } = createRequire(import.meta.url)(fixtureFile)
  const fixture = new WebhookTestFixture()
  await fixture.start()
  const closed = deferred()
  let child
  const timeout = setTimeout(() => child?.kill("SIGKILL"), 10000)
  try {
    const normal = fixture.handle
    fixture.handle = (req, res, body) => {
      res.on("close", () => closed.resolve())
      fixture.handle = normal
      child.stdin.write("abort\n")
    }
    const probe = resolve(consumer, "bun-probe.cjs")
    writeFileSync(
      probe,
      `const { WebhookBuilder } = require(${JSON.stringify(name)});
const assert = require('node:assert/strict');
(async () => {
  const controller = new AbortController(); const reason = { secret: 'installed-proof' };
  process.stdin.once('data', () => { controller.abort(reason); process.stdin.destroy(); });
  const hook = new WebhookBuilder({ baseUrl: process.env.FIXTURE_URL, tenant: 'test', dataCore: 'test', apiKey: 'synthetic' }).withRetry({ maxAttempts: 3, attemptDelayMs: 20 }).buildWebhook('flow', 'event');
  await assert.rejects(hook.send({}, undefined, { signal: controller.signal }), e => e === reason);
  assert.equal(await hook.send({}, undefined, { signal: new AbortController().signal }), 'event-0');
  assert.equal(await hook.send({}), 'event-0');
  console.log('INSTALLED_BUN_PASS');
})().catch(() => { console.error('INSTALLED_BUN_FAIL'); process.exitCode = 1; process.stdin.destroy(); });`,
    )
    child = spawn(bun, [probe], {
      cwd: consumer,
      env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "", FIXTURE_URL: fixture.url },
      stdio: ["pipe", "pipe", "pipe"],
    })
    let logs = ""
    child.stdout.on("data", (chunk) => {
      logs += chunk
    })
    child.stderr.on("data", (chunk) => {
      logs += chunk
    })
    const status = await new Promise((yes, no) => {
      child.on("error", no)
      child.on("exit", yes)
    })
    check(status === 0 && logs.includes("INSTALLED_BUN_PASS") && !logs.includes("installed-proof"), "BUN_RUNTIME")
    await closed.promise
    check(fixture.requests.length === 3, "BUN_REQUESTS")
  } finally {
    clearTimeout(timeout)
    child?.kill()
    await fixture.stop()
  }
  const proof = {
    passed: true,
    integrity,
    runtimes,
    node18Cases: 29,
    node24Cases: 29,
    types: true,
    bun: true,
    resolution: true,
    lockIntegrity: integrity,
    consumers,
  }
  writeFileSync(output, `${JSON.stringify(proof, null, 2)}\n`)
  console.log(JSON.stringify(proof))
}
try {
  await main()
} catch (error) {
  console.error(/^RELEASE_PROOF_[A-Z_]+$/.test(error?.message) ? error.message : "RELEASE_PROOF_FAILED")
  process.exitCode = 1
}
