import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { api, json } from "../../lib/api";
import { ProfileNameEditor } from "../account/ProfileNameEditor";
import { useAuth } from "../auth/AuthProvider";

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api(
        "/auth/change-password",
        json("POST", { currentPassword, newPassword }),
      );
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your profile and account security."
      />
      {user?.mustChangePassword && (
        <div className="mb-6">
          <Notice
            tone="info"
            message="Before continuing, change the temporary password provided with your account."
          />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="self-start rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <div className="mt-8 space-y-6">
            <ProfileNameEditor />
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="mt-1.5 break-all text-sm font-medium text-slate-800">
                {user?.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Roles</p>
              <p className="mt-1.5 text-sm font-medium capitalize text-slate-800">
                {user?.roles
                  .map((role) => role.replaceAll("_", " "))
                  .join(", ") || "Not assigned"}
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-base font-semibold text-slate-900">
            Change password
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Use at least 8 characters.
          </p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field
              id="current-password"
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Field
              id="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <Field
              id="confirm-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {error && <Notice message={error} />}
            {message && <Notice message={message} tone="success" />}
            <Button type="submit" className="mt-2" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
