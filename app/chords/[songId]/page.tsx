import { notFound } from "next/navigation";

import { ChordPage } from "@/components/chord-page";
import { getSongById } from "@/lib/song-data";

type ChordRouteProps = {
  params: Promise<{
    songId: string;
  }>;
};

export default async function ChordRoute({ params }: ChordRouteProps) {
  const { songId } = await params;
  const song = await getSongById(songId);

  if (!song) {
    notFound();
  }

  return <ChordPage song={song} />;
}
