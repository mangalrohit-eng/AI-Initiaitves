import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

export default function ImpactLeversLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
