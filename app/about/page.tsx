import { AboutPage } from "@/components/about-page";
import { getSiteData } from "@/lib/site-data";

export default async function AboutRoute() {
  const siteData = await getSiteData();

  return <AboutPage siteData={siteData} />;
}
