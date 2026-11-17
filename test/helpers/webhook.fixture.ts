// Node/Jest adaptation of Pathways tests/helpers/test-server.ts at
// 281d6f9cf350f76bdb75dc1366753b025feb0783 and WebhookTestFixture recipe
// f21efd04-8073-4f14-8dab-3d5271461634. One in-process external HTTP fixture.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { Socket } from "node:net"

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

export class WebhookTestFixture {
  readonly requests: { url: string; headers: IncomingMessage["headers"]; body: string }[] = []
  readonly sockets = new Set<Socket>()
  handle: (req: IncomingMessage, res: ServerResponse, body: string) => void = (req, res, body) => {
    const count = req.url?.startsWith("/events/") ? JSON.parse(body).length : 1
    res.setHeader("Content-Type", "application/json")
    res.end(
      JSON.stringify(
        req.url?.startsWith("/event/")
          ? { eventId: "event-0" }
          : {
              eventIds: Array.from({ length: count }, (_, i) => `event-${i}`),
              checksum: "sum",
              hashType: "sha256",
            },
      ),
    )
  }
  private server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = Buffer.concat(chunks).toString()
    this.requests.push({ url: req.url ?? "", headers: req.headers, body })
    this.handle(req, res, body)
  })
  url = ""
  async start() {
    this.server.on("connection", (socket) => {
      this.sockets.add(socket)
      socket.on("close", () => this.sockets.delete(socket))
    })
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve))
    const address = this.server.address()
    if (!address || typeof address === "string") throw new Error("Fixture failed to bind")
    this.url = `http://127.0.0.1:${address.port}`
  }
  async stop() {
    for (const socket of this.sockets) socket.destroy()
    await new Promise<void>((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())))
  }
}
