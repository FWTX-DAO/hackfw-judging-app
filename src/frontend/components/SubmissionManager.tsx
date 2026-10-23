import React, { useState } from "react";
import { PROBLEM_TRACKS, VERIFICATION_ITEMS, isGithubRepository, type TeamMember, type VerificationField } from "../../shared/submissions";
import { useAddProject, useDeleteProject, useUpdateProject } from "../hooks/useQueries";
import type { Project } from "../lib/types";

export function SubmissionManager({ projects }: { projects: Project[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const pending = addProject.isPending || updateProject.isPending || deleteProject.isPending;
  const error = addProject.error || updateProject.error || deleteProject.error;

  const save = async (patch: Partial<Project> & { name: string; team: string; description: string }) => {
    try {
      if (editing === "new") await addProject.mutateAsync(patch);
      else if (typeof editing === "number") await updateProject.mutateAsync({ id: editing, patch });
      setEditing(null);
    } catch { /* Keep the form and entered values; show the mutation error below. */ }
  };

  return (
    <section className="plate plate--riveted" style={{ padding: "20px 22px" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="stencil" style={{ fontSize: 22 }}>Submissions & team check-in</h2>
        <button className="btn-primary" disabled={pending || editing !== null} onClick={() => setEditing("new")}>Add Submission</button>
      </div>
      <p style={{ fontSize: 13, margin: "0 0 16px", color: "var(--color-text-secondary)" }}>
        Review the evidence and check off all five requirements. On Demo Day morning, check each team in
        before judging. Links alone do not count as verification. Editing the team or evidence resets the affected checks.
      </p>
      {error && <p role="alert" className="chip chip--danger">{(error as Error).message}</p>}
      {editing === "new" && <SubmissionForm onSave={save} onCancel={() => setEditing(null)} pending={pending} />}
      {!projects.length && editing !== "new" && <p>No submissions yet. Add a submission or import from Devpost below.</p>}
      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <article key={project.id} style={{ background: "var(--color-ink)", border: "1px solid var(--color-border-strong)", padding: 16 }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div style={{ minWidth: 0 }}>
                <h3 className="stencil" style={{ fontSize: 20, overflowWrap: "anywhere" }}>{project.name}</h3>
                <p style={{ fontSize: 13, margin: "4px 0", overflowWrap: "anywhere" }}>{project.team}</p>
                <span className={`chip ${project.requirements_met ? "chip--ok" : "chip--warn"}`}>
                  {project.requirements_met ? "✓ Ready for judging" : `${5 - project.missing_requirements.length}/5 verified`}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={pending || editing !== null} onClick={() => setEditing(project.id)}>Edit Submission & Team</button>
                <button className="btn-danger" disabled={pending} onClick={() => setDeleting(project.id)}>Delete</button>
              </div>
            </div>
            {deleting === project.id && (
              <div role="alert" style={{ marginBottom: 16 }}>
                <p>Delete {project.name}, its team details and all submitted scores?</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" disabled={pending} onClick={() => setDeleting(null)}>Cancel</button>
                  <button className="btn-danger" disabled={pending} onClick={async () => {
                    try { await deleteProject.mutateAsync(project.id); setDeleting(null); if (editing === project.id) setEditing(null); } catch {}
                  }}>Delete Submission & Scores</button>
                </div>
              </div>
            )}
            {editing === project.id ? (
              <SubmissionForm project={project} onSave={save} onCancel={() => setEditing(null)} pending={pending} />
            ) : (
              <SubmissionChecklist project={project} pending={pending} onVerify={(field, checked) => {
                updateProject.mutate({ id: project.id, patch: { [field]: checked ? 1 : 0 } });
              }} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SubmissionChecklist({ project, pending, onVerify }: {
  project: Project;
  pending: boolean;
  onVerify: (field: VerificationField, checked: boolean) => void;
}) {
  const evidence: Record<VerificationField, { ready: boolean; href?: string; note: string }> = {
    track_verified: { ready: PROBLEM_TRACKS.some((track) => track === project.problem_track), note: project.problem_track || "Select a problem track in Edit Submission & Team." },
    github_verified: { ready: isGithubRepository(project.github_url), href: project.github_url, note: project.github_url || "Add the public repository URL." },
    video_verified: { ready: !!project.video_url, href: project.video_url, note: project.video_url || "Add the end-to-end demo URL." },
    talent_verified: { ready: project.team_members.length > 0, href: "https://talent.fwtx.city", note: project.team_members.length ? `Participants: ${project.team_members.map((member) => member.email ? `${member.name} (${member.email})` : member.name).join(", ")}` : "Add the participant roster before verifying every participant." },
    attendance_verified: { ready: project.team_members.length > 0, href: "https://luma.com/ygyxb4yy", note: project.checked_in_at ? `Checked in ${new Date(project.checked_in_at).toLocaleString()}` : "Confirm the team is physically present on Demo Day morning." },
  };
  return (
    <div className="flex flex-col gap-3">
      {VERIFICATION_ITEMS.map(({ field, label, description }) => (
        <div key={field} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
          <label className="flex items-start gap-3" style={{ fontSize: 14, cursor: "pointer", minHeight: 32 }}>
            <input type="checkbox" checked={project[field] === 1} disabled={pending || !evidence[field].ready}
              onChange={(event) => onVerify(field, event.target.checked)} style={{ marginTop: 5, accentColor: "var(--color-amber)", flexShrink: 0 }} />
            <span><strong>{label}</strong><br /><span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{description}</span></span>
          </label>
          <div style={{ marginLeft: 26, fontSize: 12, overflowWrap: "anywhere", color: "var(--color-text-secondary)" }}>
            {evidence[field].note}
            {evidence[field].ready && evidence[field].href && <><br /><a href={evidence[field].href} target="_blank" rel="noreferrer" style={{ color: "var(--color-amber-bright)" }}>Review {label.toLowerCase()} ↗</a></>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmissionForm({ project, onSave, onCancel, pending }: {
  project?: Project;
  onSave: (patch: Partial<Project> & { name: string; team: string; description: string }) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
}) {
  const [members, setMembers] = useState<TeamMember[]>(project?.team_members.length ? project.team_members : [{ name: "", email: "" }]);
  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    setMembers((current) => current.map((member, i) => i === index ? { ...member, [field]: value } : member));
  };
  const fields = [
    { name: "name", label: "Submission name", required: true },
    { name: "team", label: "Team name", required: true },
    { name: "github_url", label: "Public GitHub repository", type: "url" },
    { name: "video_url", label: "End-to-end demo video", type: "url" },
    { name: "readme_url", label: "README URL (optional)", type: "url" },
    { name: "devpost_url", label: "Devpost URL (optional)", type: "url" },
  ] as const;
  return (
    <form className="flex flex-col gap-3 mb-4" onSubmit={(event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const values = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
      void onSave({ ...values, team_members: members, name: values.name ?? "", team: values.team ?? "", description: values.description ?? "" });
    }}>
      {fields.map((field) => (
        <label key={field.name} style={{ fontSize: 13 }}>
          {field.label}
          <input name={field.name} type={"type" in field ? field.type : "text"} required={"required" in field && field.required}
            defaultValue={project?.[field.name] ?? ""} className="input-field" disabled={pending} />
        </label>
      ))}
      <label style={{ fontSize: 13 }}>Problem track
        <select name="problem_track" defaultValue={project?.problem_track ?? ""} className="input-field" required disabled={pending}>
          <option value="">Select a problem track</option>
          {PROBLEM_TRACKS.map((track) => <option key={track} value={track}>{track}</option>)}
        </select>
      </label>
      <fieldset style={{ border: "1px solid var(--color-border-strong)", padding: 12 }} disabled={pending}>
        <legend style={{ fontSize: 13, padding: "0 6px" }}>Team participants</legend>
        <p style={{ fontSize: 12, margin: "0 0 12px", color: "var(--color-text-secondary)" }}>Emails are optional and visible only to admins.</p>
        {members.map((member, index) => <div key={index} className="flex flex-wrap items-end gap-2 mb-3">
          <label style={{ flex: "1 1 180px", fontSize: 12 }}>Participant {index + 1} name
            <input value={member.name} onChange={(event) => updateMember(index, "name", event.target.value)} required className="input-field" />
          </label>
          <label style={{ flex: "1 1 180px", fontSize: 12 }}>Participant {index + 1} email (optional)
            <input type="email" value={member.email ?? ""} onChange={(event) => updateMember(index, "email", event.target.value)} className="input-field" />
          </label>
          <button type="button" className="btn-secondary" aria-label={`Remove participant ${index + 1}`} disabled={members.length === 1} onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}>Remove</button>
        </div>)}
        <button type="button" className="btn-secondary" onClick={() => setMembers((current) => [...current, { name: "", email: "" }])}>Add Participant</button>
      </fieldset>
      <label style={{ fontSize: 13 }}>Submission description
        <textarea name="description" defaultValue={project?.description ?? ""} rows={3} required className="input-field" disabled={pending} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : project ? "Save Submission & Team" : "Add Submission"}</button>
        <button type="button" disabled={pending} className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
