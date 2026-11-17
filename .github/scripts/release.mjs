// Reviewed controller CLI. Release source is never used to select controller code.
import { createHash } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const repository = "flowcore-io/library-sdk-transformer-core-ts"
const packageName = "@flowcore/sdk-transformer-core"
const repositoryUrl = `https://github.com/${repository}.git`
const stable = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const sha = /^[a-f0-9]{40}$/
const root = resolve(import.meta.dirname, "../..")
const work = resolve(process.env.RUNNER_TEMP || "/tmp", "sdk-release")
const sourceDir = resolve(root, "../release-source")
const tarball = resolve(work, "package.tgz")
const receiptFile = resolve(work, "receipt.json")
const json = (path) => JSON.parse(readFileSync(path, "utf8"))
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
function check(value, code) {
  if (!value) throw new Error(`RELEASE_${code}`)
}
function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 24 * 1024 * 1024,
    ...options,
  })
  check(!r.error && r.status === 0, "COMMAND_FAILED")
  return r.stdout.trim()
}
const npm = (args, options) => run(process.execPath, [process.env.NPM_CLI, ...args], options)
const gh = (path) => JSON.parse(run("gh", ["api", path], { timeout: 30000 }))
function releaseGuard(x) {
  check(x.repository === repository, "REPOSITORY")
  check(["workflow_dispatch", "release"].includes(x.event), "EVENT")
  check(stable.test(x.tag), "TAG")
  check(sha.test(x.workflowSha), "CONTROLLER_SHA")
  check(
    x.workflowRef ===
      `${repository}/.github/workflows/publish.yml@${x.event === "release" ? `refs/tags/${x.tag}` : "refs/heads/main"}`,
    "CONTROLLER_REF",
  )
  if (x.event === "workflow_dispatch") check(x.ref === "refs/heads/main", "DISPATCH_REF")
  const r = x.release
  check(
    r &&
      r.tag_name === x.tag &&
      r.draft === false &&
      r.prerelease === false &&
      Number.isSafeInteger(r.id) &&
      typeof r.published_at === "string" &&
      Number.isFinite(Date.parse(r.published_at)),
    "RELEASE_IDENTITY",
  )
  if (x.event === "release") check(x.eventReleaseId === r.id && x.ref === `refs/tags/${x.tag}`, "EVENT_IDENTITY")
  check(sha.test(x.source) && x.reachable === true, "SOURCE")
  if (x.tag === "v2.6.0")
    check(r.id === 448958382 && x.source === "d369caf5a8533045258b3dcaf854ff6c916453d3", "RECOVERY_IDENTITY")
  if (x.manifest)
    check(
      x.manifest.name === packageName &&
        x.manifest.version === x.tag.slice(1) &&
        x.manifest.repository?.url === repositoryUrl,
      "MANIFEST",
    )
  return {
    tag: x.tag,
    releaseId: r.id,
    publishedAt: r.published_at,
    source: x.source,
    workflowSha: x.workflowSha,
    workflowRef: x.workflowRef,
  }
}
function peel(objects) {
  check(Array.isArray(objects) && objects.length > 0 && objects.length <= 9, "TAG_DEPTH")
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]
    check(sha.test(o?.sha), "TAG_OBJECT")
    if (o.type === "commit") {
      check(i === objects.length - 1, "TAG_TRAILING")
      return o.sha
    }
    check(o.type === "tag" && i < 8 && objects[i + 1]?.parent === o.sha, "TAG_CHAIN")
  }
  throw new Error("RELEASE_TAG_DEPTH")
}
function identity() {
  check(process.env.GITHUB_REPOSITORY === repository, "REPOSITORY")
  const event = json(process.env.GITHUB_EVENT_PATH)
  const tag =
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ? event.inputs?.release_tag : event.release?.tag_name
  check(stable.test(tag), "TAG")
  const release = gh(`repos/${repository}/releases/tags/${tag}`)
  let object = gh(`repos/${repository}/git/ref/tags/${tag}`).object
  const chain = [object]
  for (let i = 0; object.type === "tag" && i < 8; i++) {
    const parent = object.sha
    object = gh(`repos/${repository}/git/tags/${parent}`).object
    chain.push({ ...object, parent })
  }
  const source = peel(chain)
  const comparison = gh(`repos/${repository}/compare/${source}...main`)
  const x = {
    repository,
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    workflowSha: process.env.GITHUB_WORKFLOW_SHA,
    tag,
    release,
    eventReleaseId: event.release?.id,
    source,
    reachable: ["ahead", "identical"].includes(comparison.status) && comparison.merge_base_commit?.sha === source,
  }
  return releaseGuard(x)
}
function hashes(file) {
  const bytes = readFileSync(file)
  check(bytes.length > 0 && bytes.length < 32 * 1024 * 1024, "TARBALL_SIZE")
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha512: createHash("sha512").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  }
}
function same(a, b, code) {
  check(JSON.stringify(a) === JSON.stringify(b), code)
}
async function registryRequest(url, binary = false, deadline = Date.now() + 20000) {
  check(Date.now() < deadline, "REGISTRY_DEADLINE")
  const target = new URL(url)
  check(
    target.protocol === "https:" &&
      target.hostname === "registry.npmjs.org" &&
      !target.username &&
      !target.password &&
      !target.port,
    "REGISTRY_URL",
  )
  let response
  try {
    response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(Math.max(1, Math.min(20000, deadline - Date.now()))),
      headers: { accept: binary ? "application/octet-stream" : "application/json" },
    })
  } catch {
    throw new Error("RELEASE_REGISTRY_UNKNOWN")
  }
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    check(size <= 32 * 1024 * 1024, "REGISTRY_SIZE")
    chunks.push(chunk)
  }
  const bytes = Buffer.concat(chunks)
  if (binary) {
    check(response.status === 200, "REGISTRY_DOWNLOAD")
    return bytes
  }
  let body
  try {
    body = JSON.parse(bytes.toString())
  } catch {
    throw new Error("RELEASE_REGISTRY_PARSE")
  }
  return { status: response.status, body }
}
function newer(a, b) {
  check(stable.test(`v${a}`) && stable.test(`v${b}`), "LATEST_VERSION")
  const aa = a.split(".").map(BigInt)
  const bb = b.split(".").map(BigInt)
  for (let i = 0; i < 3; i++) {
    if (aa[i] !== bb[i]) return aa[i] > bb[i]
  }
  return false
}
function registryGuard(x) {
  check(
    x.package.status === 200 &&
      x.package.body.name === packageName &&
      x.package.body.versions &&
      x.package.body["dist-tags"],
    "REGISTRY_UNKNOWN",
  )
  const latest = x.package.body["dist-tags"].latest
  check(typeof latest === "string" && !newer(latest, x.version), "NEWER_LATEST")
  if (x.versionResponse.status === 404) {
    check(!Object.hasOwn(x.package.body.versions, x.version), "REGISTRY_INCONSISTENT")
    return "absent"
  }
  check(x.versionResponse.status === 200, "REGISTRY_UNKNOWN")
  const v = x.versionResponse.body
  check(
    v.name === packageName && v.version === x.version && /^sha512-[A-Za-z0-9+/]{86}==$/.test(v.dist?.integrity),
    "REGISTRY_CONFLICT",
  )
  check(
    v.dist.integrity === x.integrity && v.repository?.url === repositoryUrl && (!v.gitHead || v.gitHead === x.source),
    "REGISTRY_CONFLICT",
  )
  const u = new URL(v.dist.tarball)
  check(
    u.protocol === "https:" &&
      u.hostname === "registry.npmjs.org" &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.pathname === `/@flowcore/sdk-transformer-core/-/sdk-transformer-core-${x.version}.tgz`,
    "REGISTRY_URL",
  )
  return "matching"
}
async function registry(receipt, deadline = Date.now() + 40000) {
  const url = "https://registry.npmjs.org/@flowcore%2fsdk-transformer-core"
  const packageResponse = await registryRequest(url, false, deadline)
  const versionResponse = await registryRequest(`${url}/${receipt.tag.slice(1)}`, false, deadline)
  const outcome = registryGuard({
    package: packageResponse,
    versionResponse,
    version: receipt.tag.slice(1),
    integrity: receipt.hashes.integrity,
    source: receipt.source,
  })
  return { outcome, metadata: versionResponse.body }
}
function proofGuard(receipt, actual) {
  same(receipt.hashes, actual, "TARBALL_CHANGED")
  check(receipt.proof?.passed === true && receipt.proof.integrity === actual.integrity, "PROOF_REQUIRED")
  same(receipt.proof.runtimes, { node18: "v18.12.1", node24: "v24.15.0", bun: "1.4.4" }, "PROOF_RUNTIMES")
  check(
    receipt.proof.node18Cases === 29 &&
      receipt.proof.node24Cases === 29 &&
      receipt.proof.types === true &&
      receipt.proof.bun === true &&
      receipt.proof.resolution === true &&
      receipt.proof.lockIntegrity === actual.integrity,
    "PROOF_INCOMPLETE",
  )
}
// Read a receipt only from the final controller step's immutable Actions log file.
// A URL, gitHead, source-produced log line or arbitrary downloaded JSON is not trusted.
function priorReceipt(receipt) {
  const runs = gh(`repos/${repository}/actions/workflows/publish.yml/runs?status=success&per_page=50`).workflow_runs
  for (const r of runs) {
    if (
      String(r.id) === process.env.GITHUB_RUN_ID ||
      !["release", "workflow_dispatch"].includes(r.event) ||
      r.repository?.full_name !== repository ||
      r.path !== ".github/workflows/publish.yml"
    )
      continue
    if (r.event === "workflow_dispatch" && r.head_branch !== "main") continue
    const ancestry = gh(`repos/${repository}/compare/${r.head_sha}...main`)
    if (!["ahead", "identical"].includes(ancestry.status) || ancestry.merge_base_commit?.sha !== r.head_sha) continue
    const workflow = gh(`repos/${repository}/contents/.github/workflows/publish.yml?ref=${r.head_sha}`)
    const helper = gh(`repos/${repository}/contents/.github/scripts/release.mjs?ref=${r.head_sha}`)
    const proofHelper = gh(`repos/${repository}/contents/.github/scripts/prove.mjs?ref=${r.head_sha}`)
    if (
      Buffer.from(workflow.content, "base64").toString() !==
        readFileSync(resolve(root, ".github/workflows/publish.yml"), "utf8") ||
      Buffer.from(helper.content, "base64").toString() !== readFileSync(import.meta.filename, "utf8") ||
      Buffer.from(proofHelper.content, "base64").toString() !==
        readFileSync(resolve(root, ".github/scripts/prove.mjs"), "utf8")
    )
      continue
    // Controller workflow/helper are byte-identical to this reviewed controller.
    const zip = resolve(work, `run-${r.id}.zip`)
    const download = spawnSync("gh", ["api", `repos/${repository}/actions/runs/${r.id}/logs`], {
      timeout: 30000,
      maxBuffer: 32 * 1024 * 1024,
    })
    check(download.status === 0 && download.stdout.length < 32 * 1024 * 1024, "PRIOR_LOGS")
    writeFileSync(zip, download.stdout)
    const paths = run("unzip", ["-Z1", zip])
      .split("\n")
      .filter((p) => /^build\/\d+_Publish verified tarball\.txt$/.test(p))
    check(paths.length === 1, "PRIOR_LOG_STEP")
    const lines = run("unzip", ["-p", zip, paths[0]]).split("\n")
    for (const line of lines) {
      const marker = line.indexOf("SDK_RELEASE_RECEIPT=")
      if (marker < 0) continue
      let old
      try {
        old = JSON.parse(line.slice(marker + 20))
      } catch {
        continue
      }
      if (
        old.schema === 1 &&
        old.runId === String(r.id) &&
        old.runAttempt === String(r.run_attempt) &&
        old.workflowSha === r.head_sha &&
        old.source === receipt.source &&
        old.releaseId === receipt.releaseId &&
        old.tag === receipt.tag &&
        JSON.stringify(old.hashes) === JSON.stringify(receipt.hashes) &&
        old.registryVerified === true
      ) {
        proofGuard(old, receipt.hashes)
        return old
      }
    }
  }
  throw new Error("RELEASE_EXISTING_UNQUALIFIED")
}
async function verifyRegistry(receipt, metadata) {
  const bytes = await registryRequest(metadata.dist.tarball, true)
  const downloaded = resolve(work, "registry.tgz")
  writeFileSync(downloaded, bytes)
  same(hashes(downloaded), receipt.hashes, "REGISTRY_BYTES")
  // Reinstall and re-exercise the actual registry bytes, separately from prepublish.
  run(
    process.execPath,
    [resolve(root, ".github/scripts/prove.mjs"), downloaded, sourceDir, resolve(work, "registry-proof.json")],
    { timeout: 600000 },
  )
  const proof = json(resolve(work, "registry-proof.json"))
  proofGuard({ ...receipt, proof }, hashes(downloaded))
  receipt.registryProof = proof
}
async function main() {
  const command = process.argv[2]
  if (command === "offline") {
    const x = JSON.parse(readFileSync(0, "utf8"))
    let result
    if (x.action === "release") result = releaseGuard(x)
    else if (x.action === "peel") result = peel(x.objects)
    else if (x.action === "registry") result = registryGuard(x)
    else if (x.action === "proof") {
      proofGuard(x.receipt, x.actual)
      result = "qualified"
    } else throw new Error("RELEASE_OFFLINE_ACTION")
    console.log(JSON.stringify({ result, publishInvocations: 0 }))
    return
  }
  check(process.env.GITHUB_ACTIONS === "true", "HOSTED_ONLY")
  mkdirSync(work, { recursive: true })
  if (command === "resolve") {
    const receipt = {
      schema: 1,
      ...identity(),
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }
    check(run("git", ["rev-parse", "HEAD"]) === receipt.workflowSha, "CONTROLLER_CHECKOUT")
    save(receiptFile, receipt)
    appendFileSync(process.env.GITHUB_OUTPUT, `source=${receipt.source}\n`)
    console.log(JSON.stringify(receipt))
    return
  }
  const receipt = json(receiptFile)
  if (command === "source") {
    check(realpathSync(sourceDir) !== realpathSync(root), "SOURCE_DIRECTORY")
    check(
      run("git", ["rev-parse", "HEAD"], { cwd: sourceDir }) === receipt.source &&
        run("git", ["status", "--porcelain"], { cwd: sourceDir }) === "",
      "SOURCE_CHECKOUT",
    )
    const manifest = json(resolve(sourceDir, "package.json"))
    check(
      manifest.name === packageName &&
        manifest.version === receipt.tag.slice(1) &&
        manifest.repository?.url === repositoryUrl,
      "MANIFEST",
    )
    check(!existsSync(resolve(sourceDir, ".gitmodules")), "UNEXPECTED_SUBMODULES")
    receipt.manifestHash = createHash("sha256")
      .update(readFileSync(resolve(sourceDir, "package.json")))
      .digest("hex")
    receipt.lockHash = createHash("sha256")
      .update(readFileSync(resolve(sourceDir, "yarn.lock")))
      .digest("hex")
    save(receiptFile, receipt)
  } else if (command === "pack") {
    check(
      process.version === "v24.15.0" &&
        npm(["--version"]) === "11.6.2" &&
        run(process.execPath, [process.env.YARN_CLI, "--version"]) === "1.22.22",
      "TOOLCHAIN",
    )
    check(!existsSync(tarball), "PACK_ONCE")
    const packed = JSON.parse(
      npm(["pack", "--ignore-scripts", "--json", "--pack-destination", work], { cwd: sourceDir }),
    )
    check(
      packed.length === 1 && /^flowcore-sdk-transformer-core-\d+\.\d+\.\d+\.tgz$/.test(packed[0].filename),
      "PACK_NAME",
    )
    const files = packed[0].files.map((f) => f.path)
    check(
      files.includes("dist/index.js") &&
        files.includes("dist/index.d.ts") &&
        files.includes("dist/flowcore/webhook-builder/cancellation.js") &&
        files.includes("README.md") &&
        files.includes("LICENSE.txt") &&
        files.every(
          (p) =>
            /^(package\.json|README\.md|LICENSE\.txt|dist\/[A-Za-z0-9_./-]+\.(?:js|d\.ts|json))$/.test(p) &&
            !p.split("/").includes(".."),
        ),
      "PACK_FILES",
    )
    const built = resolve(work, packed[0].filename)
    const manifest = JSON.parse(run("tar", ["-xOf", built, "package/package.json"]))
    check(
      manifest.name === packageName &&
        manifest.version === receipt.tag.slice(1) &&
        manifest.repository?.url === repositoryUrl,
      "PACK_MANIFEST",
    )
    run("mv", [built, tarball])
    receipt.hashes = hashes(tarball)
    receipt.files = files
    receipt.tools = { node: process.version, npm: "11.6.2", yarn: "1.22.22" }
    save(receiptFile, receipt)
  } else if (command === "prove") {
    same(hashes(tarball), receipt.hashes, "TARBALL_CHANGED")
    run(
      process.execPath,
      [resolve(root, ".github/scripts/prove.mjs"), tarball, sourceDir, resolve(work, "proof.json")],
      { timeout: 600000 },
    )
    receipt.proof = json(resolve(work, "proof.json"))
    proofGuard(receipt, hashes(tarball))
    save(receiptFile, receipt)
    console.log(JSON.stringify(receipt))
  } else if (command === "publish") {
    proofGuard(receipt, hashes(tarball))
    same(
      identity(),
      {
        tag: receipt.tag,
        releaseId: receipt.releaseId,
        publishedAt: receipt.publishedAt,
        source: receipt.source,
        workflowSha: receipt.workflowSha,
        workflowRef: receipt.workflowRef,
      },
      "MAPPING_CHANGED",
    )
    check(
      createHash("sha256")
        .update(readFileSync(resolve(sourceDir, "package.json")))
        .digest("hex") === receipt.manifestHash &&
        createHash("sha256")
          .update(readFileSync(resolve(sourceDir, "yarn.lock")))
          .digest("hex") === receipt.lockHash,
      "SOURCE_CHANGED",
    )
    const before = await registry(receipt)
    if (before.outcome === "matching") {
      priorReceipt(receipt)
      await verifyRegistry(receipt, before.metadata)
      receipt.outcome = "verified-no-op"
    } else {
      same(
        identity(),
        {
          tag: receipt.tag,
          releaseId: receipt.releaseId,
          publishedAt: receipt.publishedAt,
          source: receipt.source,
          workflowSha: receipt.workflowSha,
          workflowRef: receipt.workflowRef,
        },
        "MAPPING_CHANGED",
      )
      proofGuard(receipt, hashes(tarball))
      // Exactly one invocation. Never retry a failed/uncertain write.
      const publication = spawnSync(
        process.execPath,
        [
          process.env.NPM_CLI,
          "publish",
          tarball,
          "--access",
          "public",
          "--provenance=false",
          "--tag",
          "latest",
          "--ignore-scripts",
        ],
        { cwd: sourceDir, encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
      )
      const deadline = Date.now() + 120000
      let observed
      for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt++) {
        observed = await registry(receipt, deadline)
        if (observed.outcome === "matching") break
        if (attempt < 11) await new Promise((r) => setTimeout(r, Math.max(0, Math.min(10000, deadline - Date.now()))))
      }
      check(
        observed?.outcome === "matching",
        /ENEEDAUTH|E401|E403|E404/.test(publication.stderr || "") ? "PUBLISH_AUTH_UNQUALIFIED" : "PUBLICATION_UNKNOWN",
      )
      await verifyRegistry(receipt, observed.metadata)
      receipt.outcome = "published-and-verified"
    }
    receipt.registryVerified = true
    save(receiptFile, receipt)
    console.log(`SDK_RELEASE_RECEIPT=${JSON.stringify(receipt)}`)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nVerified SDK release receipt\n\n\`\`\`json\n${JSON.stringify(receipt, null, 2)}\n\`\`\`\n`,
    )
  } else throw new Error("RELEASE_COMMAND")
}
try {
  await main()
} catch (error) {
  console.error(/^RELEASE_[A-Z_]+$/.test(error?.message) ? error.message : "RELEASE_UNEXPECTED")
  process.exitCode = 1
}
