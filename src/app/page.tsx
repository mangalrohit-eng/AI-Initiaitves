import { getProductsForAudience } from "@/config/products";
import { getPortalAudience } from "@/lib/portalAudience";
import { ProgramHome } from "@/components/program/ProgramHome";

export default function ProgramRootPage() {
  const mode = getPortalAudience();
  return <ProgramHome products={getProductsForAudience(mode)} portalMode={mode} />;
}
