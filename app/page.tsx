import { HomePage } from "@/components/home-page";
import { getSiteData, getSongList } from "@/lib/site-data";

export default async function HomeRoute() {
  const [siteData, songs] = await Promise.all([getSiteData(), getSongList()]);

  return <HomePage posts={siteData.posts} songs={songs} />;
}
