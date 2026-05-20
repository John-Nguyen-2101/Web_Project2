import { SongUploadForm } from "./upload-form";

export default function AdminSongUploadRoute() {
  return (
    <main className="wrapper admin-upload-page">
      <div className="container">
        <section className="admin-upload-header">
          <span className="badge">Admin-only</span>
          <h1>Song quickText upload</h1>
          <p>
            Paste a quickText song, preview the parsed structure, then save it
            into Supabase as the current song version.
          </p>
        </section>

        <SongUploadForm />
      </div>
    </main>
  );
}
