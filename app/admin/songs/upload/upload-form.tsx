"use client";

import { useActionState } from "react";

import { handleSongUploadAction } from "./actions";
import type { SongUploadActionState } from "./actions";

const initialClientSongUploadState: SongUploadActionState = {
  values: {
    title: "",
    authorName: "",
    style: "",
    tone: "",
    rhythm: "",
    timeSigTop: 4,
    timeSigBottom: 4,
    quickText: "",
    slug: "",
    legacySongId: "",
  },
  preview: null,
  message: "",
  error: "",
  songUrl: "",
};

function IssueList({
  title,
  issues,
}: {
  title: string;
  issues: NonNullable<SongUploadActionState["preview"]>["errors"];
}) {
  if (!issues.length) {
    return null;
  }

  return (
    <div className="admin-upload-issues">
      <h3>{title}</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.lineNumber || index}`}>
            <strong>{issue.code}</strong>
            {issue.lineNumber ? `, line ${issue.lineNumber}` : ""}:{" "}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ state }: { state: SongUploadActionState }) {
  const preview = state.preview;

  if (!preview) {
    return (
      <section className="card admin-upload-preview">
        <h2>Preview</h2>
        <p className="card-desc">
          Paste quickText and click Preview Parse to inspect the sections,
          chords, lyric cells, and meter before saving.
        </p>
      </section>
    );
  }

  return (
    <section className="card admin-upload-preview">
      <div className="admin-upload-preview-head">
        <div>
          <h2>Preview</h2>
          <p className="card-desc">
            {preview.stats.sections} sections, {preview.stats.bars} bars,{" "}
            {preview.stats.cells} cells, {preview.stats.chords} chords
          </p>
        </div>
        <span className="chip">
          {preview.content.meter.time_signature.top}/
          {preview.content.meter.time_signature.bottom}
        </span>
      </div>

      <IssueList title="Errors" issues={preview.errors} />
      <IssueList title="Warnings" issues={preview.warnings} />

      <div className="admin-upload-meter">
        <span>Cells per bar: {preview.content.meter.cells_per_bar}</span>
        <span>Beat map: {preview.content.meter.beat_map.join(", ")}</span>
        {preview.content.meter.meter_mode ? (
          <span>Rhythm: {preview.content.meter.meter_mode}</span>
        ) : null}
      </div>

      <div className="admin-upload-sections">
        {preview.content.sections.map((section) => (
          <article key={section.id} className="admin-upload-section">
            <h3>{section.label}</h3>
            {section.bars.map((bar) => (
              <div key={bar.bar_index} className="admin-upload-bar">
                <div className="admin-upload-bar-index">Bar {bar.bar_index}</div>
                <div className="admin-upload-cells">
                  {bar.cells.map((cell) => (
                    <div key={cell.cell_index} className="admin-upload-cell">
                      <div className="admin-upload-chord">
                        {cell.chord?.basic || ""}
                      </div>
                      <div>{cell.lyric || " "}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

export function SongUploadForm() {
  const [actionState, formAction, isPending] = useActionState(
    handleSongUploadAction,
    initialClientSongUploadState,
  );
  const state = actionState || initialClientSongUploadState;
  const values = state.values || initialClientSongUploadState.values;
  const timeSignature = `${values.timeSigTop}/${values.timeSigBottom}`;

  return (
    <div className="admin-upload-grid">
      <form action={formAction} className="card admin-upload-form">
        <div className="admin-upload-note">
          Temporary admin/dev tool. It uses the server-side Supabase service
          role and should not be linked from public navigation yet.
        </div>

        <div className="admin-upload-fields">
          <label>
            <span>Title</span>
            <input name="title" required defaultValue={values.title} />
          </label>

          <label>
            <span>Author name</span>
            <input
              name="authorName"
              required
              defaultValue={values.authorName}
            />
          </label>

          <label>
            <span>Style</span>
            <input name="style" defaultValue={values.style} />
          </label>

          <label>
            <span>Tone</span>
            <input
              name="tone"
              placeholder="C, Dm, F#, Bb..."
              defaultValue={values.tone}
            />
          </label>

          <label>
            <span>Rhythm</span>
            <input
              name="rhythm"
              placeholder="Ballad, Slow Rock, 70-80 BPM..."
              defaultValue={values.rhythm}
            />
          </label>

          <label>
            <span>Time signature</span>
            <select name="timeSignature" defaultValue={timeSignature}>
              <option value="2/4">2/4</option>
              <option value="3/4">3/4</option>
              <option value="4/4">4/4</option>
              <option value="6/8">6/8</option>
            </select>
          </label>

          <label>
            <span>Slug</span>
            <input name="slug" defaultValue={values.slug} />
          </label>

          <label>
            <span>Legacy song id</span>
            <input name="legacySongId" defaultValue={values.legacySongId} />
          </label>
        </div>

        <label className="admin-upload-quicktext">
          <span>quickText content</span>
          <textarea
            name="quickText"
            required
            rows={16}
            defaultValue={values.quickText}
            placeholder={"[Verse]\n[C] lyric / [G] lyric / /"}
          />
        </label>

        {state.message ? (
          <p className="admin-upload-message">{state.message}</p>
        ) : null}
        {state.error ? <p className="admin-upload-error">{state.error}</p> : null}
        {state.songUrl ? (
          <a className="link admin-upload-open-link" href={state.songUrl}>
            Open uploaded song
          </a>
        ) : null}

        <div className="admin-upload-actions">
          <button
            className="btn btn-ghost"
            disabled={isPending}
            name="intent"
            type="submit"
            value="preview"
          >
            Preview Parse
          </button>
          <button
            className="btn"
            disabled={isPending}
            name="intent"
            type="submit"
            value="save"
          >
            Save to Supabase
          </button>
        </div>
      </form>

      <Preview state={state} />
    </div>
  );
}
