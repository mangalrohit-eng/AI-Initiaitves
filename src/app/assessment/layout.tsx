import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
