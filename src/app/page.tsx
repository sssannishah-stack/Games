import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { UseCases } from "@/components/marketing/UseCases";
import { FinalCta } from "@/components/marketing/FinalCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function Home() {
  return (
    <>
      <MarketingNav />
      <HeroSection />
      <FeatureGrid />
      <HowItWorks />
      <UseCases />
      <FinalCta />
      <MarketingFooter />
    </>
  );
}
