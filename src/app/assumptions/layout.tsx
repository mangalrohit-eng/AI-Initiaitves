import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

export default function AssumptionsLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
