"use server";

import {
  parseQuickTextForUpload,
  saveUploadedSong,
  valuesFromFormData,
} from "@/lib/song-upload-admin";
import type { SongUploadPreview, SongUploadValues } from "@/lib/song-upload-admin";

export type SongUploadActionState = {
  values: SongUploadValues;
  preview: SongUploadPreview | null;
  message: string;
  error: string;
  songUrl: string;
};

export async function handleSongUploadAction(
  _previousState: SongUploadActionState,
  formData: FormData,
): Promise<SongUploadActionState> {
  const values = valuesFromFormData(formData);
  const intent = String(formData.get("intent") || "preview");

  if (intent === "preview") {
    const preview = parseQuickTextForUpload(values);

    return {
      values,
      preview,
      message: preview.errors.length
        ? "Preview found validation errors."
        : "Preview parsed successfully.",
      error: "",
      songUrl: "",
    };
  }

  try {
    const result = await saveUploadedSong(values);

    if (result.preview.errors.length || !result.song) {
      return {
        values,
        preview: result.preview,
        message: "",
        error: "Fix the validation errors before saving.",
        songUrl: "",
      };
    }

    return {
      values,
      preview: result.preview,
      message: "Song saved to Supabase.",
      error: "",
      songUrl: `/chords/${encodeURIComponent(result.song.legacy_song_id)}`,
    };
  } catch (error) {
    return {
      values,
      preview: parseQuickTextForUpload(values),
      message: "",
      error: error instanceof Error ? error.message : "Song save failed.",
      songUrl: "",
    };
  }
}
