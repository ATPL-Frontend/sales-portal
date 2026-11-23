import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { api, json } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";

export function ProfileNameEditor() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => setName(user?.fullName ?? ""), [user?.fullName]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/auth/profile", json("PATCH", { fullName: name.trim() }));
      await refresh();
      setSuccess("Your name has been updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <Field
        id="account-full-name"
        label="Full name"
        required
        minLength={2}
        maxLength={140}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {error && <Notice message={error} />}
      {success && <Notice tone="success" message={success} />}
      <Button
        type="submit"
        disabled={busy || !name.trim() || name.trim() === user?.fullName}
      >
        {busy ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
