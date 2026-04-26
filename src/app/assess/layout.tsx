import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

export default function AssessLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
