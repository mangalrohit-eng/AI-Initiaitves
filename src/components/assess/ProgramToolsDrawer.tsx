"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Table2,
  Wrench,
} from "lucide-react";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { downloadBlob } from "@/lib/assess/downloadAssessSamples";
import { serializeAssessProgramForDownload } from "@/lib/assess/assessProgramIO";
import { getAssessProgram } from "@/lib/localStore";

type Section = "templates" | "backup";

/**
 * Quiet drawer with non-destructive program tools — empty templates, JSON
 * export, status links. Every program-wide destructive action (import,
 * restore assumptions) is reached through the `Program admin` link in the
 * global footer, never from working surfaces.
 *
 * Renders at the bottom of the Capability Map and Configure Impact Levers
 * hubs, collapsed by default.
 */
export function ProgramToolsDrawer() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<Section>("templates");

  const exportOp = useAsyncOp<void, []>({
    run: async () => {
      const p = getAssessProgram();
      const body = serializeAssessProgramForDownload(p);
      const name = `forge-assess-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(name, body, "application/json;charset=utf-8");
    },
    messages: {
      loadingTitle: "Building JSON backup",
      successTitle: "Backup downloaded",
      successDescription:
        "Store the JSON in SharePoint, Teams, or email if multiple leads need the same view.",
      errorTitle: "Couldn't export backup",
    },
  });

  return (
    <section
      id="program-tools"
      className="mt-12 rounded-2xl border border-forge-border bg-forge-surface/40"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-wider text-forge-subtle">
            Program tools
          </span>
          <span className="text-xs text-forge-hint">
            templates, backup, status
          </span>
        </span>
        <ChevronDown
          className={"h-3.5 w-3.5 text-forge-hint transition-transform " + (open ? "rotate-180" : "")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-forge-border">
          <div className="flex flex-wrap items-center gap-1 border-b border-forge-border bg-forge-well/30 px-3 py-2 text-xs">
            <SectionTab
              active={section === "templates"}
              onClick={() => setSection("templates")}
              icon={<Download className="h-3 w-3" />}
            >
              Templates
            </SectionTab>
            <SectionTab
              active={section === "backup"}
              onClick={() => setSection("backup")}
              icon={<HardDrive className="h-3 w-3" />}
            >
              Backup &amp; status
            </SectionTab>
          </div>

          <div className="px-4 py-4">
            {section === "templates" ? (
              <div className="space-y-3">
                <p className="text-xs text-forge-subtle">
                  Empty upload templates for tower leads working outside the portal.
                  Download a tower&rsquo;s current map from its Capability Map page.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/assess-tower-template.xlsx"
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-accent-purple" />
                    Empty template (Excel)
                  </a>
                  <a
                    href="/assess-tower-template.csv"
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30"
                  >
                    Empty template (CSV)
                  </a>
                </div>
              </div>
            ) : null}

            {section === "backup" ? (
              <div className="space-y-3">
                <p className="text-xs text-forge-subtle">
                  Take a JSON snapshot of current program state any time — non-destructive.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void exportOp.fire()}
                    disabled={exportOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                  >
                    <FileJson className="h-3.5 w-3.5 text-accent-purple" />
                    {exportOp.state === "loading" ? "Exporting..." : "Export JSON backup"}
                  </button>
                  <Link
                    href="/program/tower-status"
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-teal/35"
                  >
                    <Table2 className="h-3.5 w-3.5 text-accent-teal" />
                    Tower step status
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectionTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition " +
        (active
          ? "bg-forge-surface text-forge-ink shadow-[0_0_0_1px_rgba(161,0,255,0.2)]"
          : "text-forge-subtle hover:bg-forge-surface hover:text-forge-body")
      }
    >
      {icon}
      {children}
    </button>
  );
}
