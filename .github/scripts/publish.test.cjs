const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { resolve } = require("node:path")
const { spawnSync } = require("node:child_process")
const root = resolve(__dirname, "../..")
const workflow = readFileSync(resolve(root, ".github/workflows/publish.yml"), "utf8")
test("publication retains release events and adds only stable-tag main-controller dispatch", () => {
  for (const text of [
    "workflow_dispatch:",
    "release_tag:",
    "types: [published]",
    "refs/heads/main",
    "github.workflow_sha",
    "persist-credentials: false",
    "cancel-in-progress: false",
    "timeout-minutes:",
    "65c6ca86fdeb0ab3d85e78f57e4f6a7e4780b391",
    "f43a0e5ff2bd294095638e18286ca9a3d1956744",
    "24.15.0",
    "11.6.2",
    "1.22.22",
  ])
    assert.ok(workflow.includes(text), text)
  assert.doesNotMatch(workflow, /secrets\.|NODE_AUTH_TOKEN|yarn publish|new-version|continue-on-error/)
})
test("workflow runs exact-artifact proof before its single publish entrypoint", () => {
  assert.ok(workflow.indexOf("release.mjs prove") > 0)
  assert.ok(workflow.indexOf("release.mjs publish") > workflow.indexOf("release.mjs prove"))
  assert.equal((workflow.match(/release.mjs publish/g) || []).length, 1)
  assert.ok(workflow.includes("steps.release.outputs.source"))
})
const base = {
  repository: "flowcore-io/library-sdk-transformer-core-ts",
  event: "workflow_dispatch",
  ref: "refs/heads/main",
  tag: "v2.6.0",
  workflowRef: "flowcore-io/library-sdk-transformer-core-ts/.github/workflows/publish.yml@refs/heads/main",
  workflowSha: "a".repeat(40),
  source: "d369caf5a8533045258b3dcaf854ff6c916453d3",
  reachable: true,
  release: { id: 448958382, tag_name: "v2.6.0", draft: false, prerelease: false, published_at: "2026-11-17T17:17:20Z" },
  manifest: {
    name: "@flowcore/sdk-transformer-core",
    version: "2.6.0",
    repository: { url: "https://github.com/flowcore-io/library-sdk-transformer-core-ts.git" },
  },
}
function cli(input) {
  return spawnSync(process.execPath, [resolve(__dirname, "release.mjs"), "offline"], {
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 5000,
  })
}
test("valid release guard exits successfully", () => {
  assert.equal(cli({ action: "release", ...base }).status, 0)
})
for (const [name, patch] of Object.entries({
  draft: { release: { ...base.release, draft: true } },
  unpublished: { release: { ...base.release, published_at: null } },
  missing: { release: null },
  prerelease: { release: { ...base.release, prerelease: true } },
  injection: { tag: "v2.6.0; echo bad" },
  leadingZero: { tag: "v02.6.0" },
  branch: { ref: "refs/heads/evil" },
  repository: { repository: "elsewhere/repo" },
  moved: { source: "b".repeat(40) },
  replaced: { release: { ...base.release, id: 1 } },
  unreachable: { reachable: false },
  version: { manifest: { ...base.manifest, version: "2.5.1" } },
  package: { manifest: { ...base.manifest, name: "other" } },
  packageRepository: { manifest: { ...base.manifest, repository: { url: "https://evil.test/" } } },
  controller: { workflowRef: "x@refs/heads/evil" },
  event: { event: "push" },
})) {
  test(`rejects ${name} without publication`, () => {
    const r = cli({ action: "release", ...base, ...patch })
    assert.equal(r.status, 1, r.stdout)
    assert.doesNotMatch(r.stdout, /published/)
    assert.match(r.stderr, /RELEASE_/)
  })
}

const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const { createHash } = require("node:crypto")
const hash = {
  sha256: "a".repeat(64),
  sha512: "b".repeat(128),
  integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
}
const proof = {
  passed: true,
  integrity: hash.integrity,
  runtimes: { node18: "v18.12.1", node24: "v24.15.0", bun: "1.4.4" },
  node18Cases: 29,
  node24Cases: 29,
  types: true,
  bun: true,
  resolution: true,
  lockIntegrity: hash.integrity,
}
const registryBase = {
  action: "registry",
  version: "2.6.0",
  source: base.source,
  integrity: hash.integrity,
  package: { status: 200, body: { name: base.manifest.name, versions: {}, "dist-tags": { latest: "2.5.1" } } },
  versionResponse: { status: 404, body: { error: "Not found" } },
}
const matching = {
  status: 200,
  body: {
    ...base.manifest,
    gitHead: base.source,
    dist: {
      integrity: hash.integrity,
      tarball: "https://registry.npmjs.org/@flowcore/sdk-transformer-core/-/sdk-transformer-core-2.6.0.tgz",
    },
  },
}
test("registry absence needs both exact 404 and package/version confirmation", () => {
  assert.equal(cli(registryBase).status, 0)
  for (const patch of [
    { package: { status: 404, body: {} } },
    { versionResponse: { status: 401 } },
    { versionResponse: { status: 429 } },
    { versionResponse: { status: 500 } },
    { package: { ...registryBase.package, body: { ...registryBase.package.body, versions: { "2.6.0": {} } } } },
  ])
    assert.equal(cli({ ...registryBase, ...patch }).status, 1)
})
for (const versions of [null, [], "unavailable", true, 123]) {
  test(`malformed registry versions ${JSON.stringify(versions)} rejects before publication`, () => {
    const r = cli({
      ...registryBase,
      package: { ...registryBase.package, body: { ...registryBase.package.body, versions } },
    })
    assert.equal(r.status, 1, r.stdout)
    assert.match(r.stderr, /REGISTRY_UNKNOWN/)
    assert.doesNotMatch(r.stdout, /"result":"absent"/)
  })
}
test("matching duplicate/race bytes remain distinct from qualification of prior authority", () => {
  assert.equal(cli({ ...registryBase, versionResponse: matching }).status, 0)
  const code = readFileSync(resolve(__dirname, "release.mjs"), "utf8")
  assert.match(code, /priorReceipt\(receipt\)/)
  assert.match(code, /RELEASE_EXISTING_UNQUALIFIED/)
  assert.match(code, /r\.path !== "\.github\/workflows\/publish\.yml"/)
  assert.equal((code.match(/"publish",\s*tarball/g) || []).length, 1)
})
for (const [name, patch] of Object.entries({
  bytes: { integrity: "sha512-wrong" },
  missingIntegrity: { integrity: undefined },
  wrongHost: { tarball: "https://evil.test/package.tgz" },
  redirectPort: {
    tarball: "https://registry.npmjs.org:444/@flowcore/sdk-transformer-core/-/sdk-transformer-core-2.6.0.tgz",
  },
  query: { tarball: `${matching.body.dist.tarball}?redirect=bad` },
})) {
  test(`registry rejects ${name}`, () =>
    assert.equal(
      cli({
        ...registryBase,
        versionResponse: { ...matching, body: { ...matching.body, dist: { ...matching.body.dist, ...patch } } },
      }).status,
      1,
    ))
}
test("newer latest cannot roll back and malformed latest is unknown", () => {
  for (const latest of ["2.6.1", "3.0.0", "garbage", "2.7.0-beta.1"])
    assert.equal(
      cli({
        ...registryBase,
        package: { status: 200, body: { ...registryBase.package.body, "dist-tags": { latest } } },
      }).status,
      1,
    )
})
test("annotated tag chain peels to full commit; loops/depth fail closed", () => {
  const objects = [
    { type: "tag", sha: "1".repeat(40) },
    { type: "tag", sha: "2".repeat(40), parent: "1".repeat(40) },
    { type: "commit", sha: base.source, parent: "2".repeat(40) },
  ]
  assert.equal(cli({ action: "peel", objects }).status, 0)
  assert.equal(cli({ action: "peel", objects: objects.slice(0, 2) }).status, 1)
  assert.equal(cli({ action: "peel", objects: Array(10).fill(objects[0]) }).status, 1)
  assert.equal(cli({ action: "peel", objects: [objects[0], { ...objects[2], parent: "3".repeat(40) }] }).status, 1)
})
test("release event must match the current published release identity", () => {
  const valid = {
    ...base,
    action: "release",
    event: "release",
    ref: "refs/tags/v2.6.0",
    workflowRef: "flowcore-io/library-sdk-transformer-core-ts/.github/workflows/publish.yml@refs/tags/v2.6.0",
    eventReleaseId: 448958382,
  }
  assert.equal(cli(valid).status, 0)
  assert.equal(cli({ ...valid, eventReleaseId: 2 }).status, 1)
})
test("proof is a blocking conjunction, including every supported runtime", () => {
  assert.equal(cli({ action: "proof", receipt: { hashes: hash, proof }, actual: hash }).status, 0)
  for (const patch of [
    { passed: false },
    { types: false },
    { bun: false },
    { resolution: false },
    { node18Cases: 28 },
    { node24Cases: 28 },
    { lockIntegrity: "wrong" },
    { integrity: "wrong" },
    { runtimes: { ...proof.runtimes, node18: null } },
  ])
    assert.equal(
      cli({ action: "proof", receipt: { hashes: hash, proof: { ...proof, ...patch } }, actual: hash }).status,
      1,
    )
  assert.equal(
    cli({ action: "proof", receipt: { hashes: hash, proof }, actual: { ...hash, sha256: "changed" } }).status,
    1,
  )
})
for (const [name, patch] of Object.entries({
  failedInstall: { passed: false },
  failedTypes: { types: false },
  failedRuntime: { bun: false },
  wrongResolution: { resolution: false },
  missingRuntime: { runtimes: {} },
  absentProof: null,
  changedTarball: "changed",
})) {
  test(`actual publish entrypoint makes zero npm calls after ${name}`, () => {
    const directory = mkdtempSync(resolve(tmpdir(), "sdk-publish-reject-"))
    try {
      mkdirSync(resolve(directory, "sdk-release"))
      const bytes = Buffer.from("synthetic-tgz")
      const h = {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sha512: createHash("sha512").update(bytes).digest("hex"),
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      }
      writeFileSync(resolve(directory, "sdk-release/package.tgz"), bytes)
      const valid = { ...proof, integrity: h.integrity, lockIntegrity: h.integrity }
      writeFileSync(
        resolve(directory, "sdk-release/receipt.json"),
        JSON.stringify({
          hashes: name === "changedTarball" ? hash : h,
          proof: patch === null ? null : { ...valid, ...(typeof patch === "object" ? patch : {}) },
        }),
      )
      const sentinel = resolve(directory, "npm-called")
      const npmCli = resolve(directory, "npm.cjs")
      writeFileSync(npmCli, `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'called')`)
      const result = spawnSync(process.execPath, [resolve(__dirname, "release.mjs"), "publish"], {
        env: { ...process.env, GITHUB_ACTIONS: "true", RUNNER_TEMP: directory, NPM_CLI: npmCli },
        encoding: "utf8",
        timeout: 5000,
      })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /RELEASE_(PROOF|TARBALL)/)
      assert.equal(require("node:fs").existsSync(sentinel), false)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
test("removing the installed-consumer workflow gate is detected", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "sdk-workflow-mutant-"))
  try {
    mkdirSync(resolve(directory, ".github/scripts"), { recursive: true })
    mkdirSync(resolve(directory, ".github/workflows"), { recursive: true })
    writeFileSync(resolve(directory, ".github/scripts/publish.test.cjs"), readFileSync(__filename))
    writeFileSync(
      resolve(directory, ".github/workflows/publish.yml"),
      workflow.replace("release.mjs prove", "release.mjs removed"),
    )
    const childEnv = { ...process.env }
    childEnv.NODE_TEST_CONTEXT = undefined
    const r = spawnSync(
      process.execPath,
      [
        "--test",
        "--test-name-pattern=workflow runs exact-artifact",
        resolve(directory, ".github/scripts/publish.test.cjs"),
      ],
      { encoding: "utf8", timeout: 5000, env: childEnv },
    )
    assert.equal(r.status, 1, r.stdout + r.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test("source, dispatch and integrity mutations defeat the relevant negative controls", () => {
  const code = readFileSync(resolve(__dirname, "release.mjs"), "utf8")
  const mutations = [
    [
      'r.id === 448958382 && x.source === "d369caf5a8533045258b3dcaf854ff6c916453d3"',
      "r.id === 448958382",
      { action: "release", ...base, source: "b".repeat(40) },
    ],
    ['x.ref === "refs/heads/main"', "true", { action: "release", ...base, ref: "refs/heads/evil" }],
    [
      'same(receipt.hashes, actual, "TARBALL_CHANGED")',
      'check(true, "TARBALL_CHANGED")',
      { action: "proof", receipt: { hashes: hash, proof }, actual: { ...hash, sha256: "changed" } },
    ],
  ]
  for (const [from, to, input] of mutations) {
    const directory = mkdtempSync(resolve(tmpdir(), "sdk-cli-mutant-"))
    try {
      assert.ok(code.includes(from), from)
      const file = resolve(directory, "release.mjs")
      writeFileSync(file, code.replace(from, to))
      const r = spawnSync(process.execPath, [file, "offline"], {
        input: JSON.stringify(input),
        encoding: "utf8",
        timeout: 5000,
      })
      assert.equal(r.status, 0, r.stderr)
      assert.equal(cli(input).status, 1)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})
