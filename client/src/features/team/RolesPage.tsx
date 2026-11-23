import { Lock, Plus, Shield, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { api, json, type Permission, type Role } from "../../lib/api";

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [r, p] = await Promise.all([
        api<{ roles: Role[] }>("/admin/roles"),
        api<{ permissions: Permission[] }>("/admin/permissions"),
      ]);
      setRoles(r.roles);
      setPermissions(p.permissions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setSelected([]);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description);
    setSelected(role.permissions);
    setFormError("");
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (editing) {
        await api(
          `/admin/roles/${editing.id}/permissions`,
          json("PUT", { permissionKeys: selected }),
        );
      } else {
        await api(
          "/admin/roles",
          json("POST", { name, description, permissionKeys: selected }),
        );
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setError("");
    try {
      await api(`/admin/roles/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles & access"
        description="Decide what each role is allowed to do."
        action={
          <Button onClick={openCreate}>
            <Plus size={17} /> New role
          </Button>
        }
      />
      {error && (
        <div className="mb-5">
          <Notice message={error} />
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-9 text-sm text-slate-400">Loading roles…</div>
        ) : roles.length ? (
          <div className="divide-y divide-slate-100">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-7 sm:py-6"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  {role.name === "super_admin" ? (
                    <Lock size={19} />
                  ) : (
                    <Shield size={19} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold capitalize text-slate-800">
                      {role.name.replaceAll("_", " ")}
                    </h2>
                    {role.name === "super_admin" && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Protected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {role.description || "No description"}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {role.permissions.length} permissions
                </span>
                {role.name !== "super_admin" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(role)}
                  >
                    Manage
                  </Button>
                )}
                {!role.system && role.name !== "super_admin" && (
                  <button
                    type="button"
                    onClick={() => setDeleting(role)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-9 text-sm text-slate-400">
            No roles have been created.
          </div>
        )}
      </section>
      {deleting && (
        <Dialog
          title="Delete role?"
          description="This action removes the role and its permissions permanently."
          onClose={() => {
            if (!deleteBusy) setDeleting(null);
          }}
        >
          <p className="mb-6 text-sm text-slate-700">
            Delete{" "}
            <strong className="capitalize">
              {deleting.name.replaceAll("_", " ")}
            </strong>
            ? Roles currently assigned to users cannot be deleted. Reassign
            those users first.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
              className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteBusy ? "Deleting…" : "Delete role"}
            </button>
          </div>
        </Dialog>
      )}
      {modalOpen && (
        <Dialog
          title={editing ? "Manage permissions" : "Create role"}
          description="Select which actions this role can access."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={submit} className="space-y-5">
            {!editing && (
              <>
                <Field
                  id="role-name"
                  label="Role key"
                  hint="e.g. sales_manager"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  pattern="[a-z][a-z0-9_]{2,49}"
                  required
                />
                <Field
                  id="role-description"
                  label="Description"
                  maxLength={255}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">
                Permissions
              </legend>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-slate-900"
                      checked={selected.includes(permission.key)}
                      onChange={(event) =>
                        setSelected((values) =>
                          event.target.checked
                            ? [...values, permission.key]
                            : values.filter((key) => key !== permission.key),
                        )
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        {permission.key}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {formError && <Notice message={formError} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : editing
                    ? "Save permissions"
                    : "Create role"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
