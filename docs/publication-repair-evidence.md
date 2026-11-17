# Guarded SDK publication repair

Implementation scope of independently accepted Plan
61b30718-096e-4c34-8f57-93edc11d11d7 in Flowcore workspace
60c10ca2-4115-4c1a-b6d7-04ac39fd3938. Parent
d740e260-70df-4ae9-9b95-56fb2164a944 remains open downstream.
Predecessor f23cd77e-8f3c-4af3-a8fc-b20dbf641105 remains rejected history.

## Immutable inputs and limits

The owned checkout was clean at a21a4e040ebff85672e4bd6e7069a20a11360cb4.
Fetched origin/main d369caf5a8533045258b3dcaf854ff6c916453d3 and created
ordinary branch fix/guarded-npm-release in the existing checkout.
Candidate-to-main changes are CHANGELOG.md and package.json release metadata.
Release 448958382 is published stable v2.6.0 at that source commit.
Exact registry version GET returned 404 on 17 November 2026. This observation
must be refreshed by the workflow. No source, dependency, lock or version change.

Historical publish run 44135322049 failed with missing NPM_TOKEN. Historical
release formatter failed on expanded package.json arrays, and release Test was
skipped. Those remain failed/skipped evidence. This repair restores ordinary
branch formatting; parsed package.json is deeply equal to origin/main.

Main protection API returns 404 with MAINTAIN access. Visible branch rules
cover repository deletion/transfer/visibility only. Protection is unknown;
no policy change or bypass. No merge, dispatch, publication or tag mutation.
Target-package/workflow Blacksmith authority remains unqualified. No secret
search, new grants, runner fallback, auth fallback or provenance claim.

## Implementation

The existing publish role retains release:published and adds one required
release_tag input. Dispatch runs from main. Pinned controller checkout and
immutable release-source checkout are distinct. Canonical stable tags, published
release identity, recursive annotated-tag peeling, main ancestry, package identity
and v2.6.0's exact release ID/source are checked before package scripts.

Node 24.15.0, npm 11.6.2 and Yarn 1.22.22 build once with frozen dependencies.
Node 18.12.1 and Bun 1.4.4 are blocking consumer qualifications. Pinned Blacksmith
setup-node keeps contents:read and id-token:write; workflow supplies no npm token.
Actions:read permits authenticated prior-run receipt inspection. Checkout stores
no credentials. The pinned upload-artifact action archives the single tarball
and prepublication receipt for 90 days. No artifact input or download selects
the package to publish.

The controller packs once, validates package contents and binds public installed
proof to SHA256/SHA512/SRI. Fresh external consumers have generated locks, checked
integrity and real installed resolution. The unchanged 29-case public suite and
public types run on both Node versions. Bun uses the same established fixture,
owned by Node, with native installed-export cancellation, recovery and omitted
signal sends. No SDK source import, test resolver patch or replacement transport.

After proof, the controller rechecks bytes, source/lock and live release mapping.
Registry absence requires package existence plus exact-version 404 and absence
from package metadata. Unknown/auth/parse/conflict/newer-latest states block writes.
One npm publish invocation uses the fixed tgz and provenance=false. Error/duplicate
recovery has at most 12 reads within a two-minute registry deadline and never a
second publish. Matching registry bytes undergo a separate installed proof.

An existing version requires a successful prior publish.yml run from this repo,
main ancestry, byte-identical controller workflow/release/proof code and a matching
receipt in the isolated final step's authenticated immutable Actions log. A URL or
gitHead alone is insufficient. Expired/missing logs fail unqualified. A no-op does
not mutate dist-tags. The final public receipt and job summary include both proofs.
Actual receipt/log/archive/auth behavior remains a hosted recovery gate.

## Local observations

- RED: old workflow fails dispatch/controller and prepublication-gate checks.
  Missing new CLI also produces expected initial implementation failures.
- GREEN: 39 public subprocess/static tests. Published/draft/unpublished/missing/
  prerelease/invalid/injection/replaced/moved/annotated tags, branch/controller/
  package/source rejection, registry absent/matching/conflict/unknown/newer-latest,
  proof conjunction, missing runtime and changed bytes are exercised.
- Seven actual publish-entrypoint negative cases use a sentinel npm executable.
  Failed install/types/runtime/resolution, missing runtime/proof and changed tgz
  all exit before any npm call. Synthetic proof receipts test the publication
  boundary; they do not pretend to execute a failed hosted consumer install.
- Mutants removing source pin, dispatch ref or integrity comparison are accepted
  by the mutated CLI and rejected by production CLI. Removing installed proof
  from workflow makes its regression fail.
- Frozen Yarn 1.22.22 install, lint, full formatter, build/declarations, tsc
  --noEmit, public test:types and 29-case Jest suite pass on official Node 24.15.0.
- actionlint 1.7.12 with committed Blacksmith label configuration and diff whitespace
  pass. Both changed YAML files parse and every shell block passes bash -n.
  ShellCheck is absent; no ShellCheck execution is claimed.
- Isolated local packed-consumer proof passes public types and 29 cases each on
  Node 18.12.1 and Node 24.15.0, plus Bun 1.4.4 through the external Node fixture.
  Initial runs exposed macOS /var realpath normalization and Node manifest-cache
  setup errors; both were corrected before passing. A recursive node:test mutation
  runner initially skipped its child; clearing inherited NODE_TEST_CONTEXT made
  the negative control execute and fail as intended.

Local test artifact only, built from this ordinary repair branch. Its formatting
bytes differ from the old tagged source. It is never a qualifying workflow-built
release artifact, never an input to the publish workflow and never published.

- SHA256: 0e3f07cfe4798f35d03da539f9f03f92cbe28f5889c7b1e1ae941e3bbc71bd1e
- SHA512: 04b4b5fcf4d00336f8c42228b2b40a7a786d9ef7b0ee3c900dabf22f225d020e964fc0a092324b92c4e1537852728c1245bef337c72535e38bc06f448e9a228b
- SRI: sha512-BLS1/PTQAzb4xCIosrQKenhtnvew7jyQDavyLyJdAg6WT8CgkjJLksThU3hScowSRb7zN8clNeOLwG9Ejpoiiw==
- Both generated consumer locks SHA256:
  525c7ffa522b56b02d27a66ff475afbf38ee091c834dcc32379e2b12d794ae9f
- Existing yarn.lock unchanged SHA256:
  57cba7b47a05bbec4fa55765da589d698f1c893eb97ff8e885c14149a7318e72

## Source and standards receipt

Full accepted replacement, independent ACCEPT and parent retrieved, along with
current baseline/library/CI/BBT maps and their declared applicable references.
Baseline ca165b47-a358-477d-b1bc-4cc5ec39f3f6 version 2026-10-14.1;
library 8fde746b-b670-47eb-bcf8-ba21b0ff1397;
CI 2a08ff13-21ce-4c50-a25d-4456bbfd6f93 version 2026-10-02;
BBT dc51012b-5154-4993-887c-1afc447cd812 and doctrine
df4cc063-8e3f-4b34-9d25-cca7a3d838d3. Full reads returned isPartial=false.

BBT-C1: public CLI/package, zero app-src imports including helpers. BBT-C2:
existing WebhookTestFixture reused. BBT-C3: no pathway no-op. BBT-C4: no sidecar.
BBT-C5: no UI. BBT-C6: negative/error/conflict cases plus mutation controls.
CICD-C1/C2: no cluster/personal runtime credentials. C3/C4: release-please version
ownership and release-workflow-only publication artifact. C5: existing three roles.
C6: no store promotion. C7: ordinary PR, no bypass. C8: existing job-level skip
retained, publish never skipped. Logger/privacy rules apply through fixed errors
and allowlisted public receipt fields. No event/encryption/DB/UI implementation;
parent runtime/store/fence requirements are unchanged. No exception or waiver.

Pinned Blacksmith action commit 65c6ca86fdeb0ab3d85e78f57e4f6a7e4780b391
manifest, auth source and executable bundle revalidated. Bundle SHA256
925b855184b06d46768545fc0e007dccbc0ac47989c8037e9b5526f2f197b46e.
It exports a dummy token placeholder, not proof of a publishing grant. Current
canonical flowcore-sdk workflow 250f52868f2eee92908c887e511510fb5b199e47
retains id-token and provenance=false. Older no-id-token/floating npm recipes
are historical and do not override accepted Plan pins or certify this package.
Checkout f43a0e5ff2bd294095638e18286ca9a3d1956744 and archive action
ea165f8d65b6e75b540449e92b4886f43607fa02 manifests exist at those exact commits.

## Handoff gates

Root owns independent exact-head implementation/security/standards review,
hosted CI assessment, ordinary merge, reviewed-main dispatch and real release
artifact/registry qualification. No watches or polling initiated by this worker.
Author Forge submission is not independent ACCEPT. No screenshot/video evidence
is manufactured for a non-UI workflow change; verification is recorded in Forge's
narrative/file claims. No screenshot binaries committed.

Supported scoped Klokkan participation a73c7a05-95fc-5481-939c-ff66d9882f89
under organization 6395a253-9b2c-400c-9ffa-4fb33561b159/project
6ee51fbc-0d8a-42a5-b26a-ace780881d25. Initial discovery before scoped start was
untracked. Other participants and routing remain untouched. Finish only this
participation before handback. No local timing installation or foreign timer stop.
