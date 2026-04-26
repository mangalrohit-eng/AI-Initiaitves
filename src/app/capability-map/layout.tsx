import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

export default function CapabilityMapLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
