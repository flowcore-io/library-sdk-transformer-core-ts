import { WebhookBuilder } from ".."
import { deferred, WebhookTestFixture } from "./helpers/webhook.fixture"

let fixture: WebhookTestFixture
beforeEach(async () => {
  fixture = new WebhookTestFixture()
  await fixture.start()
})
afterEach(async () => {
  await fixture.stop()
})
const builder = () =>
  new WebhookBuilder({ baseUrl: fixture.url, tenant: "test", dataCore: "test", apiKey: "synthetic" })

it("pre-abort rejects original reason without dispatch or callbacks", async () => {
  const controller = new AbortController()
  const reason = { secret: "never-on-wire" }
  controller.abort(reason)
  let calls = 0
  const hook = builder()
    .withPredicate({
      predicate: () => {
        calls++
        return true
      },
    })
    .buildWebhook("flow", "event")
  await expect(hook.send({}, undefined, { signal: controller.signal })).rejects.toBe(reason)
  expect(fixture.requests).toHaveLength(0)
  expect(calls).toBe(0)
})

it("aborts while ingestion headers are withheld, closes the request and never retries", async () => {
  const entered = deferred()
  const closed = deferred()
  fixture.handle = (_req, res) => {
    res.on("close", () => closed.resolve())
    entered.resolve()
  }
  const controller = new AbortController()
  const reason = new Error("private-abort")
  const call = builder()
    .withRetry({ maxAttempts: 3, attemptDelayMs: 20 })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
  const result = call.catch((error) => error)
  await entered.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  await closed.promise
  expect(Date.now() - start).toBeLessThan(1000)
  expect(fixture.requests).toHaveLength(1)
})

it.each([200, 400, 500])("aborts a never-ending %i JSON body and closes its connection", async (status) => {
  const entered = deferred()
  const closed = deferred()
  fixture.handle = (_req, res) => {
    res.on("close", () => closed.resolve())
    res.writeHead(status, { "Content-Type": "application/json" })
    res.write('{"partial":')
    entered.resolve()
  }
  const controller = new AbortController()
  const reason = { secret: "body-reason" }
  const result = builder()
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
  await entered.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  await closed.promise
  expect(Date.now() - start).toBeLessThan(1000)
})

it.each(["status", "network"])("aborts during %s retry backoff with no late request", async (fault) => {
  const backoff = deferred()
  const closed = deferred()
  fixture.handle = (req, res) => {
    res.on("close", () => closed.resolve())
    if (fault === "network") req.socket.destroy()
    else {
      res.writeHead(503)
      res.write("unfinished")
    }
  }
  const controller = new AbortController()
  const reason = Symbol("private-reason")
  const result = builder()
    .withRetry({
      maxAttempts: 3,
      attemptDelayMs: () => {
        backoff.resolve()
        return 50
      },
    })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
  await backoff.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  await closed.promise
  expect(Date.now() - start).toBeLessThan(1000)
  await new Promise((resolve) => setTimeout(resolve, 180))
  expect(fixture.requests).toHaveLength(1)
})

it.each(["single", "batch", "file"])("pre-aborted %s never prepares or dispatches", async (mode) => {
  const controller = new AbortController()
  controller.abort()
  const b = builder().withLocalTransform({ baseUrl: fixture.url })
  const payload = {
    toJSON() {
      throw new Error("must not serialize")
    },
  }
  const options = { signal: controller.signal }
  const hook = b.buildWebhook("flow", "event")
  const result =
    mode === "single"
      ? hook.send(payload, undefined, options)
      : mode === "batch"
        ? hook.sendBatch([payload], undefined, options)
        : b
            .buildFileWebhook("flow", "event")
            .send(
              { fileId: "file", fileName: "test.txt", fileType: "text/plain", fileContent: new Blob(["test"]) },
              undefined,
              options,
            )
  await expect(result).rejects.toMatchObject({ name: "AbortError" })
  expect(fixture.requests).toHaveLength(0)
})

it.each(["batch", "file"])("aborts dispatched %s with original reason and no predicate", async (mode) => {
  const entered = deferred()
  const closed = deferred()
  fixture.handle = (_req, res) => {
    res.on("close", () => closed.resolve())
    entered.resolve()
  }
  const controller = new AbortController()
  const reason = 0
  let calls = 0
  const b = builder().withPredicate({
    predicate: () => {
      calls++
      return true
    },
  })
  const result = (
    mode === "batch"
      ? b.buildWebhook("flow", "event").sendBatch([{}, {}], undefined, { signal: controller.signal })
      : b
          .buildFileWebhook("flow", "event")
          .send(
            { fileId: "file", fileName: "test.txt", fileType: "text/plain", fileContent: new Blob(["test"]) },
            undefined,
            { signal: controller.signal },
          )
  ).catch((e) => e)
  await entered.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  await closed.promise
  expect(Date.now() - start).toBeLessThan(1000)
  expect(calls).toBe(0)
})

it.each(["headers", "error-body"])("aborts local-transform %s without predicate or retry", async (fault) => {
  const entered = deferred()
  const closed = deferred()
  const ingestion = fixture.handle
  fixture.handle = (req, res, body) => {
    if (req.url?.startsWith("/event/")) return ingestion(req, res, body)
    res.on("close", () => closed.resolve())
    if (fault === "error-body") {
      res.writeHead(500)
      res.write('{"partial":')
    }
    entered.resolve()
  }
  let predicates = 0
  const controller = new AbortController()
  const reason = "private-local-reason"
  const result = builder()
    .withLocalTransform({ baseUrl: fixture.url })
    .withPredicate({
      predicate: () => {
        predicates++
        return true
      },
    })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
  await entered.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  await closed.promise
  expect(Date.now() - start).toBeLessThan(1000)
  expect(predicates).toBe(0)
  expect(fixture.requests).toHaveLength(2)
})

it("disposes an unused successful local-transform body before predicate and settlement", async () => {
  const closed = deferred()
  const ingestion = fixture.handle
  fixture.handle = (req, res, body) => {
    if (req.url?.startsWith("/event/")) return ingestion(req, res, body)
    res.on("close", () => closed.resolve())
    res.writeHead(200)
    res.write("unused-unfinished-body")
  }
  expect(await builder().withLocalTransform({ baseUrl: fixture.url }).buildWebhook("flow", "event").send({})).toBe(
    "event-0",
  )
  await closed.promise
})

it("aborts at the ACK/local-transform boundary before dispatch", async () => {
  const controller = new AbortController()
  let serialized = 0
  const reason = { private: "ack-boundary" }
  // Public payload serializer is invoked once for ingestion and again for local transform.
  const payload = {
    toJSON() {
      if (++serialized === 2) controller.abort(reason)
      return { item: 1 }
    },
  }
  const result = builder()
    .withLocalTransform({ baseUrl: fixture.url })
    .buildWebhook("flow", "event")
    .send(payload, undefined, { signal: controller.signal })
    .catch((e) => e)
  expect(await result).toBe(reason)
  expect(fixture.requests).toHaveLength(1)
})

it("drains an uncooperative predicate and suppresses its late success", async () => {
  const entered = deferred()
  const release = deferred<boolean>()
  let settled = false
  let receivedSignal: AbortSignal | undefined
  const controller = new AbortController()
  const reason = { private: "predicate" }
  const result = builder()
    .withPredicate({
      predicate: (_id, signal) => {
        receivedSignal = signal
        entered.resolve()
        return release.promise
      },
    })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
    .finally(() => {
      settled = true
    })
  await entered.promise
  controller.abort(reason)
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(settled).toBe(false)
  expect(receivedSignal?.aborted).toBe(true)
  release.resolve(true)
  expect(await result).toBe(reason)
  expect(fixture.requests).toHaveLength(1)
})

it("cooperative predicate sees cancellation and original reason survives its rejection", async () => {
  const entered = deferred()
  const controller = new AbortController()
  const reason = { private: "cooperative" }
  const result = builder()
    .withPredicate({
      predicate: (_id, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("callback-wrapper")), { once: true })
          entered.resolve()
        }),
    })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
  await entered.promise
  const start = Date.now()
  controller.abort(reason)
  expect(await result).toBe(reason)
  expect(Date.now() - start).toBeLessThan(1000)
})

it("aborts predicate backoff without another callback", async () => {
  const entered = deferred()
  let calls = 0
  const controller = new AbortController()
  const reason = { private: "backoff" }
  const result = builder()
    .withPredicate({
      predicate: () => {
        calls++
        return false
      },
      options: {
        maxAttempts: 3,
        attemptDelayMs: () => {
          entered.resolve()
          return 40
        },
      },
    })
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch((e) => e)
  await entered.promise
  controller.abort(reason)
  expect(await result).toBe(reason)
  await new Promise((resolve) => setTimeout(resolve, 140))
  expect(calls).toBe(1)
})

it("first batch callback failure stops siblings and drains every started callback", async () => {
  const entered = deferred()
  const fail = deferred<boolean>()
  const release = deferred<boolean>()
  const reason = new Error("first-terminal-cause")
  const controller = new AbortController()
  const signals: AbortSignal[] = []
  let calls = 0
  let settled = false
  const result = builder()
    .withPredicate({
      predicate: (_id, signal) => {
        calls++
        if (signal) signals.push(signal)
        if (calls === 2) entered.resolve()
        return calls === 1 ? fail.promise : release.promise
      },
      options: { maxAttempts: 3, attemptDelayMs: 10 },
    })
    .buildWebhook("flow", "event")
    .sendBatch([{}, {}], undefined, { signal: controller.signal })
    .catch((e) => e)
    .finally(() => {
      settled = true
    })
  await entered.promise
  fail.reject(reason)
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(settled).toBe(false)
  controller.abort("later-caller-abort")
  expect(signals.every((s) => s.aborted)).toBe(true)
  release.reject(new Error("late-secondary-error"))
  expect(await result).toBe(reason)
  expect(calls).toBe(2)
})

it("first local-transform rejection cancels and drains active sibling transport", async () => {
  const both = deferred()
  const closed = deferred()
  const ingestion = fixture.handle
  const responses: import("node:http").ServerResponse[] = []
  fixture.handle = (req, res, body) => {
    if (req.url?.startsWith("/events/")) return ingestion(req, res, body)
    responses.push(res)
    if (responses.length === 2) {
      res.on("close", () => closed.resolve())
      both.resolve()
    }
  }
  const result = builder()
    .withLocalTransform({ baseUrl: fixture.url })
    .buildWebhook("flow", "event")
    .sendBatch([{}, {}], undefined, { signal: new AbortController().signal })
    .catch((e) => e)
  await both.promise
  responses[0].writeHead(400)
  responses[0].end('{"error":"fixture"}')
  await expect(result).resolves.toMatchObject({ name: "WebhookLocalTransformerError" })
  await closed.promise
  expect(fixture.requests).toHaveLength(3)
})

it("independent writes and fresh-signal recovery succeed after cancellation", async () => {
  const entered = deferred()
  const ingestion = fixture.handle
  fixture.handle = (req, res, body) => (body.includes("blocked") ? entered.resolve() : ingestion(req, res, body))
  const hook = builder().buildWebhook("flow", "event")
  const controller = new AbortController()
  const reason = { private: "unrelated" }
  const result = hook.send({ blocked: true }, undefined, { signal: controller.signal }).catch((e) => e)
  await entered.promise
  expect(await hook.send({ independent: true })).toBe("event-0")
  controller.abort(reason)
  expect(await result).toBe(reason)
  expect(await hook.send({ recovered: true }, undefined, { signal: new AbortController().signal })).toBe("event-0")
})

it("completed ACK may win before subsequent cancellation", async () => {
  const controller = new AbortController()
  const result = await builder().buildWebhook("flow", "event").send({}, undefined, { signal: controller.signal })
  controller.abort("too-late")
  expect(result).toBe("event-0")
})

it("preserves payload, native encryption markers, audit and business time without signal leakage", async () => {
  const payload = { encryptedPayload: "synthetic.iv.ciphertext.tag" }
  const metadata = {
    "pathways/encrypted": "true",
    "pathways/encryption-scheme": "aes-256-gcm-sha256-v1",
    keyId: "key-1",
    "audit/session-id": "session",
  }
  const time = new Date("2026-11-01T12:00:00.000Z")
  const controller = new AbortController()
  const hook = builder().buildWebhook("flow", "event")
  expect(await hook.send(payload, metadata, { signal: controller.signal, eventTime: time, validTime: time })).toBe(
    "event-0",
  )
  expect(await hook.sendBatch([payload, payload], metadata, { eventTimeKey: "time", validTimeKey: "valid" })).toEqual([
    "event-0",
    "event-1",
  ])
  expect(fixture.requests[0].body).toBe(JSON.stringify(payload))
  expect(fixture.requests[0].headers["x-flowcore-event-time"]).toBe(time.toISOString())
  expect(fixture.requests[0].headers["x-flowcore-valid-time"]).toBe(time.toISOString())
  expect(
    JSON.parse(Buffer.from(fixture.requests[0].headers["x-flowcore-metadata-json"] as string, "base64").toString()),
  ).toEqual(metadata)
  expect(fixture.requests[1].headers["x-flowcore-event-time-key"]).toBe("time")
  expect(JSON.stringify(fixture.requests)).not.toContain("signal")
  expect(JSON.stringify(fixture.requests)).not.toContain("reason")
})

it("omitted signal preserves predicate exception retries and selected ID order", async () => {
  let calls = 0
  const hook = builder()
    .withPredicate({
      predicate: () => {
        if (++calls === 1) throw new Error("transient")
        return true
      },
      options: { maxAttempts: 2, attemptDelayMs: 1 },
    })
    .buildWebhook("flow", "event")
  expect(await hook.sendBatch([{}, {}])).toEqual(["event-0", "event-1"])
  expect(calls).toBe(4)
})

it("synchronous abort in a predicate prevents later batch callbacks", async () => {
  const controller = new AbortController()
  const reason = { private: "stop-scheduling" }
  let calls = 0
  const result = builder()
    .withPredicate({
      predicate: () => {
        calls++
        controller.abort(reason)
        return true
      },
    })
    .buildWebhook("flow", "event")
    .sendBatch([{}, {}, {}], undefined, { signal: controller.signal })
    .catch((e) => e)
  expect(await result).toBe(reason)
  expect(calls).toBe(1)
})

it("repeated cancellations release caller listeners and do not log private reasons", async () => {
  const { getEventListeners } = require("node:events") as {
    getEventListeners: (signal: AbortSignal, event: string) => unknown[]
  }
  const { spawn } = await import("node:child_process")
  const { resolve } = await import("node:path")
  const entered = deferred()
  fixture.handle = (_req, res) => {
    res.writeHead(503)
    res.end("retry")
    entered.resolve()
  }
  // A separate public-package consumer captures real diagnostics and must exit naturally.
  // Its 60-second retry timer would keep the child alive if abort failed to clear it.
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    const { WebhookBuilder } = require(process.argv[1]);
    const { getEventListeners } = require('node:events');
    (async () => {
      for (let i = 0; i < 12; i++) {
        const controller = new AbortController();
        const reason = { secret: 'PRIVATE_REASON_SENTINEL' };
        const hook = new WebhookBuilder({ baseUrl: process.argv[2], tenant: 'test', dataCore: 'test', apiKey: 'synthetic' })
          .withRetry({ maxAttempts: 3, attemptDelayMs: () => { setImmediate(() => controller.abort(reason)); return 60000 } })
          .buildWebhook('flow', 'event');
        try { await hook.send({}, undefined, { signal: controller.signal }); throw Error('unexpected-success') }
        catch (error) { if (error !== reason) throw Error('reason-identity') }
        if (getEventListeners(controller.signal, 'abort').length) throw Error('listener-leak');
      }
      console.log('CANCELLED_AND_DRAINED');
    })().catch(() => { console.error('QUALIFICATION_FAILED'); process.exitCode = 1 });
  `,
      resolve("."),
      fixture.url,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  )
  let output = ""
  child.stdout.on("data", (data) => {
    output += data
  })
  child.stderr.on("data", (data) => {
    output += data
  })
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", resolve)
  })
  const watchdog = setTimeout(() => child.kill("SIGKILL"), 4500)
  try {
    await entered.promise
    expect(await exit).toBe(0)
    expect(output).toContain("CANCELLED_AND_DRAINED")
    expect(output).not.toContain("PRIVATE_REASON_SENTINEL")
    expect(fixture.requests).toHaveLength(12)
  } finally {
    clearTimeout(watchdog)
    child.kill()
  }
  const controller = new AbortController()
  controller.abort()
  await builder()
    .buildWebhook("flow", "event")
    .send({}, undefined, { signal: controller.signal })
    .catch(() => undefined)
  expect(getEventListeners(controller.signal, "abort")).toHaveLength(0)
})

it("omitted signal retains transport retries, multipart contents and timestamp headers", async () => {
  const ingestion = fixture.handle
  let attempt = 0
  fixture.handle = (req, res, body) => {
    if (++attempt === 1) {
      res.writeHead(503)
      res.end("retry")
    } else ingestion(req, res, body)
  }
  const time = new Date("2026-11-01T12:00:00.000Z")
  const result = await builder()
    .withRetry({ maxAttempts: 2, attemptDelayMs: 1 })
    .buildFileWebhook("flow", "event")
    .send(
      {
        fileId: "file",
        fileName: "test.txt",
        fileType: "text/plain",
        fileContent: new Blob(["file-content"]),
        additionalProperties: { version: 1 },
      },
      { "audit/mode": "system" },
      { eventTime: time, validTime: time },
    )
  expect(result).toEqual(["event-0"])
  expect(fixture.requests).toHaveLength(2)
  expect(fixture.requests[1].body).toContain("file-content")
  expect(fixture.requests[1].body).toContain('"version":1')
  expect(fixture.requests[1].headers["content-type"]).toContain("multipart/form-data")
  expect(fixture.requests[1].headers["x-flowcore-valid-time"]).toBe(time.toISOString())
})

it("preserves unrelated validation and transport errors when not aborted", async () => {
  fixture.handle = (_req, res) => {
    res.writeHead(400)
    res.end('{"error":"fixture","message":"invalid"}')
  }
  await expect(builder().buildWebhook("flow", "event").send({})).rejects.toMatchObject({ name: "WebhookSendError" })
  fixture.handle = (req) => req.socket.destroy()
  await expect(builder().buildWebhook("flow", "event").send({})).rejects.toMatchObject({ name: "WebhookSendError" })
})
