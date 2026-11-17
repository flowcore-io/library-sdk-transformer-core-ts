# Native cancellation implementation receipt

SDK scope of accepted Plan d740e260-70df-4ae9-9b95-56fb2164a944 in Flowcore
workspace 60c10ca2-4115-4c1a-b6d7-04ac39fd3938. Base
056d0cf4f7755348a7ad5fee44432cb424cecc7d. No release/version change.

## Contract and downstream ownership

The README documents the additive signal options, optional predicate signal,
body disposal, terminal cancellation, original in-process reason and all-started
drain. False predicate results keep polling. With a supplied signal, thrown
predicate errors stop the group after drain. With signal omitted, existing
predicate exception retry behavior remains. A later caller abort cannot replace
an earlier terminal branch failure while that group drains.

This SDK has no confirmation store, encryption implementation or chunk store.
It preserves the payload, native metadata markers, business-time headers and ID
order it receives. Pathways must implement session-resolver propagation without
fallback on abort, chunk/file preparation checks and all-started confirmation
drain. Its complete isProcessed operation may run lazy DDL and expiry DELETEs.
Those operations must finish before rejection; they are not read-only. An
uncancellable store or callback can block settlement indefinitely. Core must
prove its exact fireAndForget mode never enters confirmation, retains the fence
until native transport settles, and preserves immutable same-intent recovery
after uncertain remote acceptance. SDK cancellation cannot retract an event.

## RED and GREEN

Before implementation, a baseline build succeeded. `yarn test --runInBand`
executed two runtime regressions against the built public root export. Pre-abort
incorrectly resolved event-0; withheld headers exceeded the independent 5000 ms
watchdog, then fixture teardown closed the connection. `yarn tsc --noEmit
--strict --skipLibCheck --target es2020 --module commonjs
test/types/cancellation.ts` failed for absent signal properties and absent
predicate argument. Runtime RED was separate from compiler RED.

After implementation, all 29 boundary cases pass on Node 18.12.1 and Node 25.8.0.
They cover preabort, withheld headers, partial 200/400/500 bodies, retryable-status
and network backoff, single/batch/multipart sends, local-transform headers and
error bodies, unused success-body disposal, ACK/transform boundary, cooperative
and blocked predicates, predicate backoff, first-cause preservation with a later
abort, late sibling rejection, sibling transport cancellation, independent writes,
fresh-signal recovery, completed ACK, immutable wire/time/metadata compatibility,
omitted-signal retries, and unrelated errors.

Transport cases observe a real server milestone before abort. They assert public
settlement and server-observed response closure within 1000 ms on a responsive
event loop, under the larger 5000 ms watchdog. Retry-horizon checks observe no
late sends. A child consumer performs 12 cancellations with configured 60000 ms
backoff and exits naturally; caller listeners are empty and captured diagnostics
exclude its synthetic private reason. Started uncooperative callbacks remain
pending until an external release; late success cannot become public success.
These measurements do not bound synchronous work, event-loop stalls or callbacks.

Commands passed:

- `yarn install --frozen-lockfile` with Yarn 1.22.22, lock unchanged.
- `yarn build`, including declaration generation.
- `yarn tsc --noEmit` and `yarn test:types`.
- `yarn test --runInBand` on Node 25.8.0.
- `npx --yes --package=node@18.12.1 node node_modules/jest/bin/jest.js --runInBand`.
- `yarn lint`, `yarn biome format .`, `git diff --check`.
- `yarn pack --filename /tmp/sdk-cancellation-candidate.tgz` and tar inventory.

An isolated /tmp consumer installs the actual tarball through the real npm CLI,
then compiles public types and runs real HTTP preabort/batch/body-cancellation
probes on Node 18.12.1 and Node 25.8.0. No source or test files are in the package;
the compiled cancellation helper is present in its runtime import closure.
An external Node fixture also verifies the packed export on Bun 1.3.10 and Bun
1.4.4. Running the fixture itself inside Bun 1.3.10 did not produce the expected
server-close observation and was stopped; the Node-owned fixture removes that
fixture-runtime ambiguity. Deno is absent locally, so no Deno runtime claim.

## Standards and operational observations

Full accepted replacement and ACCEPT judgement read. Full current Pathways,
BBT, baseline/library, CI and encryption maps and applicable doctrine, fixture,
API, privacy and library-release references read. BBT-C1..C6 apply through public
package exports, zero src imports including helpers, one reusable in-process
fixture adapted from pinned Pathways test-server and the canonical fixture
recipe, no sidecar/global fetch replacement, and fault/compatibility coverage.
No UI, schema, provisioning or new business event exists. PATHWAYS-C1..C6 and
ENC-C1..C10 preserve upstream/downstream event, encryption and table ownership.
No new key, metadata disclosure, fallback, service or database implementation.
The existing validation role now runs build, public types, boundary tests and
formatting, retaining Blacksmith and skipping release-please jobs. Existing
machine release/publish workflows and npm-provenance behavior are unchanged.

GitHub main protection endpoint returned 404 with MAINTAIN access. Applicable
rules returned only organization deletion/transfer/visibility controls. No branch
policy was changed or bypassed. Independent implementation audit and hosted
exact-head checks remain gates before merge/release.

Klokkan is absent in this SDK repository. Both repository skill locations were
checked. The available legacy wrapper and verified official installer expose
shared project timer commands without thread ownership. No ambiguous timer was
started/stopped or routing changed. No time-recording success is claimed.

One initial GREEN attempt hit transient host ENOSPC; later commands completed.
The Mac's npm wrapper invoked Bun during an attempted isolated install and
briefly added candidate dependencies to the parent vitliki checkout. Those exact
manifest/lock additions were reverted, frozen dependencies restored, original
SDK symlink restored, temporary consumer link removed, and parent git status
verified clean. All intended code changes are confined to this SDK repository.
No children, outgoing email, publication, merge or release.
