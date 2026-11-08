/**
 * R2-W3-01 acceptance check — @pfaas/lifecycle (executed, not claimed).
 *
 * Runs twice against one file-backed localStorage shim so the two runs play
 * the two apps that share the demo origin's storage key:
 *
 *   bun scripts/lifecycle-check.ts write   # "trader app": emits + projects
 *   bun scripts/lifecycle-check.ts read    # "prop-admin": reads the same log
 *
 * Verifies: idempotent emission, persistence, projector stage/ETA, and that
 * a second consumer on the same key sees exactly the same transitions.
 */

const MODE = process.argv[2];
if (MODE !== "write" && MODE !== "read") {
  console.error("usage: bun scripts/lifecycle-check.ts <write|read>");
  process.exit(2);
}

import { readFileSync, writeFileSync } from "node:fs";

const FILE = process.env.LIFECYCLE_CHECK_FILE ?? "/tmp/pfaas-lifecycle-check.json";
let backing: Record<string, string> = {};
try {
  backing = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  backing = {};
}
const flush = () => writeFileSync(FILE, JSON.stringify(backing));

const localStorage = {
  getItem: (k: string) => (k in backing ? backing[k] : null),
  setItem: (k: string, v: string) => {
    backing[k] = v;
    flush();
  },
  removeItem: (k: string) => {
    delete backing[k];
    flush();
  },
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage,
  addEventListener() {},
  removeEventListener() {},
};

const { emitLifecycle, readLifecycleLog, projectStatus, clearLifecycleLog } = await import(
  "../packages/lifecycle/src/lifecycle"
);

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

if (MODE === "write") {
  console.log("write: trader-side emission + projection");
  clearLifecycleLog();

  const first = emitLifecycle({
    entity: { kind: "kyc", id: "self" },
    name: "kyc.submitted",
    actor: "trader",
    key: "0:submitted",
    payload: { applicant: "Tom Allen", country: "United States" },
    at: "2026-11-08T10:00:00.000Z",
  });
  const dup = emitLifecycle({
    entity: { kind: "kyc", id: "self" },
    name: "kyc.submitted",
    actor: "trader",
    key: "0:submitted",
  });

  check("first emission appends", first !== null);
  check("same entity+name+key is a no-op", dup === null);
  check("log holds exactly one submission", readLifecycleLog().length === 1, `len=${readLifecycleLog().length}`);

  const projected = projectStatus("self");
  check("projector stage = Submitted", projected.stage === "Submitted", projected.stage);
  check(
    "projector ETA = submitted + 1h",
    projected.eta === "2026-11-08T11:00:00.000Z",
    String(projected.eta),
  );
  check("projector names the next stage", projected.nextStage === "Review started", String(projected.nextStage));

  emitLifecycle({
    entity: { kind: "kyc", id: "self" },
    name: "kyc.approved",
    actor: "prop-admin",
    key: "self:approved",
    at: "2026-11-08T14:00:00.000Z",
  });
  const verdict = projectStatus("self");
  check("terminal stage has no follow-up", verdict.nextStage === null && verdict.eta === null);
  check("terminal stage label = Approved", verdict.stage === "Approved", verdict.stage);

  emitLifecycle({
    entity: { kind: "payout", id: "po-req-1" },
    name: "payout.requested",
    actor: "trader",
    key: "po-req-1",
    payload: { reference: "PO-R1", amount: 1000, currency: "USD" },
    at: "2026-11-08T15:00:00.000Z",
  });
  check("log now holds 3 events", readLifecycleLog().length === 3, `len=${readLifecycleLog().length}`);
  check(
    "unresolved payout projects Processing ETA (+2h)",
    projectStatus("po-req-1").eta === "2026-11-08T17:00:00.000Z",
    String(projectStatus("po-req-1").eta),
  );
} else {
  console.log("read: second consumer on the same storage key");
  const log = readLifecycleLog();
  check("sees the events written by the other app", log.length === 3, `len=${log.length}`);
  check(
    "sees the trader's kyc.submitted first",
    log[0]?.name === "kyc.submitted" && log[0]?.actor === "trader",
    `${log[0]?.name}/${log[0]?.actor}`,
  );
  check("projector agrees across apps", projectStatus("self").stage === "Approved", projectStatus("self").stage);
  check(
    "cross-app payout intake source event present",
    log.some((e) => e.name === "payout.requested" && e.actor === "trader"),
  );
}

console.log(failures === 0 ? `\n${MODE}: PASS` : `\n${MODE}: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
