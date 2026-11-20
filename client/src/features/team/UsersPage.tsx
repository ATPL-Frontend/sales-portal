import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { api, json, type Role, type StaffUser } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, inputClass } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { PageHeader } from '../../components/ui/PageHeader';

export function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const [u, r] = await Promise.all([
        api<{ users: StaffUser[] }>('/admin/users'),
        api<{ roles: Role[] }>('/admin/roles'),
      ]);
      setUsers(u.users);
      setRoles(r.roles.filter(role => role.name !== 'super_admin'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    setName(''); setEmail(''); setPassword(''); setRoleIds([]); setActive(true);
    setFormError(''); setModalOpen(true);
  }

  function openEdit(user: StaffUser) {
    setEditing(user);
    setName(user.fullName); setEmail(user.email); setPassword('');
    setRoleIds(roles.filter(role => user.roles.includes(role.name)).map(role => role.id));
    setActive(user.active);
    setFormError(''); setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (editing) {
        await api(`/admin/users/${editing.id}`, json('PATCH', { fullName: name, roleIds, active }));
      } else {
        await api('/admin/users', json('POST', { fullName: name, email, password, roleIds }));
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = users.filter(user =>
    `${user.fullName} ${user.email} ${user.roles.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Team members" description="Manage the people who can access your workspace." action={<Button onClick={openCreate}><Plus size={17}/> Add member</Button>} />
      {error && <div className="mb-5"><Notice message={error}/></div>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-2.5"><Users size={18} className="text-slate-500"/><span className="text-sm font-semibold text-slate-900">Members</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{users.length}</span></div>
          <label className="relative w-full sm:w-60"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><span className="sr-only">Search team members</span><input className={`${inputClass} py-2.5 pl-9`} placeholder="Search members" value={query} onChange={event => setQuery(event.target.value)} /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs font-medium text-slate-400"><tr><th className="px-5 py-4 font-medium sm:px-7">Member</th><th className="px-5 py-4 font-medium">Role</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 text-right font-medium sm:px-7">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={4} className="px-7 py-12 text-center text-slate-400">Loading members…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-7 py-12 text-center text-slate-400">No team members found.</td></tr>}
              {!loading && filtered.map(member => (
                <tr key={member.id} className="transition hover:bg-slate-50/60">
                  <td className="px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{member.fullName.charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block font-medium text-slate-800">{member.fullName}</span><span className="block text-xs text-slate-400">{member.email}</span></span></div></td>
                  <td className="px-5 py-4 text-slate-600 capitalize">{member.roles.map(role => role.replaceAll('_', ' ')).join(', ') || 'Unassigned'}</td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${member.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`size-1.5 rounded-full ${member.active ? 'bg-emerald-500' : 'bg-slate-400'}`}/>{member.active ? 'Active' : 'Disabled'}</span></td>
                  <td className="px-5 py-4 text-right sm:px-7">{!member.roles.includes('super_admin') && <button type="button" onClick={() => openEdit(member)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"><Pencil size={13}/> Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {modalOpen && <Dialog title={editing ? 'Edit member' : 'Add team member'} description={editing ? 'Update this account’s access.' : 'Create an account with a temporary password.'} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-5">
          <Field id="member-name" label="Full name" minLength={2} maxLength={140} required value={name} onChange={event => setName(event.target.value)} placeholder="Full name" />
          {!editing && <>
            <Field id="member-email" label="Work email" type="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" />
            <Field id="member-password" label="Temporary password" hint="Min. 12 characters" type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
          </>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Assign roles</legend>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              {roles.map(role => <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"><input type="checkbox" className="size-4 accent-slate-900" checked={roleIds.includes(role.id)} onChange={event => setRoleIds(values => event.target.checked ? [...values, role.id] : values.filter(id => id !== role.id))} /><span className="text-sm capitalize text-slate-700">{role.name.replaceAll('_', ' ')}</span></label>)}
              {!roles.length && <p className="px-2 py-3 text-sm text-slate-400">No assignable roles yet.</p>}
            </div>
          </fieldset>
          {editing && <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-slate-900" checked={active} onChange={event => setActive(event.target.checked)} />Account active</label>}
          {formError && <Notice message={formError} />}
          <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</Button></div>
        </form>
      </Dialog>}
    </div>
  );
}
