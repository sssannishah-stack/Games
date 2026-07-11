import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { ShowcaseSection } from "@/components/marketing/ShowcaseSection";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { UseCases } from "@/components/marketing/UseCases";
import { CtaSection } from "@/components/marketing/CtaSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function Home() {
  return (
    <>
      <MarketingNav />
      <HeroSection />
      <ShowcaseSection />
      <FeatureGrid />
      <HowItWorks />
      <UseCases />
      <CtaSection />
      <MarketingFooter />
    </>
  );
}
