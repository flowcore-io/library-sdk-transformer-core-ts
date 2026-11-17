import { WebhookBuilder, type WebhookPredicate, type WebhookSendOptions, type WebhookSendBatchOptions } from "../.."
const signal = new AbortController().signal
const single: WebhookSendOptions = { signal, validTime: new Date(), eventTime: new Date() }
const batch: WebhookSendBatchOptions = { signal, eventTimeKey: "time" }
const oldPredicate: WebhookPredicate = (id) => Boolean(id)
const cooperative: WebhookPredicate = (_id, signal) => !signal?.aborted
const hook = new WebhookBuilder({ tenant: "test", dataCore: "test", apiKey: "synthetic" })
  .withPredicate({ predicate: oldPredicate })
  .withPredicate({ predicate: cooperative })
  .buildWebhook("flow", "event")
void hook.send({}, undefined, single)
void hook.sendBatch([{}], undefined, batch)
