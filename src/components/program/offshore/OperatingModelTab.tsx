"use client";

import {
  MapPin,
  Building2,
  Users2,
  Shield,
  Home,
  Wrench,
} from "lucide-react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type { OffshorePlanResult } from "@/lib/offshore/selectOffshorePlan";
import { offshoreLocationLabels } from "@/lib/offshore/offshoreLocationLabels";
import { fmtInt } from "./offshoreLabels";

type PlanWithProgram = OffshorePlanResult & { program: AssessProgramV2 };

/**
 * Operating model tab — six labeled sections describing how the GCC actually
 * runs day-to-day.
 *
 * Day-1 / steady-state team-shape numbers are deterministic — sourced from
 * the wave bucket movable-headcount sums in `selectOffshorePlan`. Role
 * pyramid breakdown is flagged illustrative (Accenture managed-service
 * standard ratio), not a Versant fabrication.
 */
export function OperatingModelTab({ plan }: { plan: PlanWithProgram }) {
  const wave1 = plan.waves.find((w) => w.wave === 1);
  const wave1Roles = wave1 ? wave1.rolesEnteringGcc : 0;
  const steadyState = plan.programGccIndiaSteadyState;
  const labels = offshoreLocationLabels(plan.program);

  return (
    <div className="space-y-6">
      <Section
        icon={<MapPin className="h-4 w-4" aria-hidden />}
        index={1}
        title="Location"
      >
        <ul className="space-y-2 text-sm leading-relaxed text-forge-body">
          <li>
            <strong className="text-forge-ink">
              {labels.primary} — primary GCC.
            </strong>{" "}
            Tech / engineering / data depth. Houses Tech &amp; Engineering, broader
            Service Ops, Marketing production ops.
          </li>
          <li>
            <strong className="text-forge-ink">
              {labels.secondary} — shared-service hub.
            </strong>{" "}
            Finance back-office (AR / AP / T&amp;E / intercompany / close)
            and HR ops. Lower cost-of-living and strong CA / shared-service
            talent pool relative to {labels.primary}.
          </li>
          {labels.hasHub ? (
            <li>
              <strong className="text-forge-ink">
                {labels.hub} — narrow contact-center carve-out.
              </strong>{" "}
              Multi-brand Service Ops queues only: CNBC Pro, GolfNow / GolfPass,
              Fandango, SportsEngine. English fluency during US business hours
              is the binding constraint that makes {labels.hub} the right
              destination for contact work.
            </li>
          ) : (
            <li>
              <strong className="text-forge-ink">No separate contact-center hub.</strong>{" "}
              Service Ops contact-center work routes into {labels.primary} GCC
              alongside the rest of the engineering and back-office scope.
              Configurable in the Assumptions tab.
            </li>
          )}
        </ul>
      </Section>

      <Section
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        index={2}
        title="Delivery model"
      >
        <p className="text-sm leading-relaxed text-forge-body">
          <strong className="text-forge-ink">Accenture-led managed service.</strong>{" "}
          Accenture employs the GCC FTE, owns the SLAs, runs the hyper-care,
          and carries the transition risk. Versant pays a managed fee against
          tower-level scope. Build-Operate-Transfer optionality preserved at
          Year 3 — once steady-state SLAs are demonstrated and Versant has
          stood up its newly-public corporate spine, scope can transfer to a
          Versant-owned GCC under existing Accenture contracts. Day-one BOT
          was rejected because Versant lacks GCC-ops capacity in the first
          newly-public year.
        </p>
      </Section>

      <Section
        icon={<Users2 className="h-4 w-4" aria-hidden />}
        index={3}
        title="Day-1 vs. steady-state team shape"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Day-1 stand-up (Wave 1, M0–M3)"
            value={fmtInt(wave1Roles > 0 ? Math.round(wave1Roles * 0.4) : 0)}
            sub="40% of Wave 1 movable HC active by M3 hyper-care milestone (deterministic, derived from the configured dials)"
          />
          <Stat
            label="Steady-state @ M24"
            value={fmtInt(steadyState)}
            sub="Movable HC across all three waves + existing offshore consolidated under the managed-service contract"
          />
        </div>
        <div className="mt-4 rounded-xl border border-forge-border bg-forge-well/40 p-4 text-[12px] leading-relaxed text-forge-body">
          <strong className="text-forge-ink">Role pyramid · illustrative</strong>{" "}
          — Accenture managed-service GCC standard ratio:{" "}
          <span className="font-mono">~70%</span> process associates ·{" "}
          <span className="font-mono">~25%</span> senior associates / leads ·{" "}
          <span className="font-mono">~5%</span> management. Final mix is{" "}
          <em>TBD — subject to discovery</em> against tower-by-tower scope and
          SLA targets.
        </div>
      </Section>

      <Section
        icon={<Shield className="h-4 w-4" aria-hidden />}
        index={4}
        title="Governance overlay"
      >
        <ul className="space-y-2 text-sm leading-relaxed text-forge-body">
          <li>
            <strong className="text-forge-ink">Steering chair —</strong>{" "}
            Anand Kini (CFO/COO), the cost-transformation accountable
            executive.
          </li>
          <li>
            <strong className="text-forge-ink">CEO sponsor —</strong> Mark
            Lazarus.
          </li>
          <li>
            <strong className="text-forge-ink">Standing members —</strong>{" "}
            tower leads of the four highest-impact towers (Finance, HR, Tech
            &amp; Engineering, Service Ops) plus the Accenture engagement
            partner and GCC India Country Lead.
          </li>
          <li>
            <strong className="text-forge-ink">Editorial veto —</strong> Brian
            Carovillano (SVP Standards &amp; Editorial) holds binding veto
            outside the standard escalation path on any wave gate touching
            newsroom-adjacent scope. Attends only when newsroom-adjacent
            agenda is on the docket.
          </li>
          <li>
            <strong className="text-forge-ink">Per-tower lead pairings —</strong>{" "}
            existing Versant × Accenture lead pairs (see Operating Model
            briefs) own the tower-level go / no-go on each wave.
          </li>
        </ul>
      </Section>

      <Section
        icon={<Home className="h-4 w-4" aria-hidden />}
        index={5}
        title="Onshore retained spine"
      >
        <p className="text-sm leading-relaxed text-forge-body">
          The roles and capabilities the GCC is{" "}
          <em className="not-italic">deliberately</em> not built to absorb —
          this is what stays in NYC HQ, Englewood Cliffs NJ, and DC bureau:
          MS NOW political coverage and CNBC anchor-facing producers under
          Brian Carovillano&apos;s standards function · on-air talent and
          producer-talent relationships · top-tier ad sales relationships
          (the $1.58B revenue stream Versant is rebuilding independently
          post-NBCU TSA) · SOX-critical controls through Year 1 · executive
          finance, treasury, M&amp;A counsel · CISO function (Caroline
          Richardson) · the leadership layer (Mark Lazarus, Anand Kini, Deep
          Bagchee, Nate Balogh).
        </p>
      </Section>

      <Section
        icon={<Wrench className="h-4 w-4" aria-hidden />}
        index={6}
        title="Tools the GCC operates on"
      >
        <ul className="grid gap-1.5 text-sm leading-relaxed text-forge-body sm:grid-cols-2">
          <li>
            <span className="font-display font-semibold text-forge-ink">ServiceNow</span>{" "}
            — IT shared services, employee tech support, incident ops.
          </li>
          <li>
            <span className="font-display font-semibold text-forge-ink">Workday</span>{" "}
            — HR shared services, benefits, onboarding.
          </li>
          <li>
            <span className="font-display font-semibold text-forge-ink">BlackLine</span>{" "}
            — close, reconciliations, intercompany matching.
          </li>
          <li>
            <span className="font-display font-semibold text-forge-ink">Eightfold</span>{" "}
            — talent ops back-office (resume screening, onboarding flow).
          </li>
          <li>
            <span className="font-display font-semibold text-forge-ink">CrowdStrike</span>{" "}
            — endpoint security across GCC laptops.
          </li>
          <li>
            <span className="font-display font-semibold text-forge-ink">Cisco WebEx Contact</span>{" "}
            — {labels.hasHub ? `${labels.hub} multi-brand contact-center stack` : "multi-brand contact-center stack"}.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  icon,
  index,
  title,
  children,
}: {
  icon: React.ReactNode;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent-purple/30 bg-accent-purple/5 text-[11px] font-semibold text-accent-purple-dark">
          {index}
        </span>
        <span className="text-accent-purple-dark">{icon}</span>
        <h2 className="font-display text-base font-semibold text-forge-ink">
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-accent-purple/20 bg-accent-purple/5 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-accent-purple-dark">
        {value}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-forge-subtle">
        {sub}
      </p>
    </div>
  );
}
