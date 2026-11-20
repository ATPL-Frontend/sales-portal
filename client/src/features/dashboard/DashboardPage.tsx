import { ArrowUpRight, Check, Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../auth/AuthProvider';

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName.split(' ')[0] || 'there';

  return (
    <div>
      <PageHeader eyebrow="Overview" title={`Welcome back, ${firstName}.`} description="A quieter place to manage your sales workspace." />
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 sm:p-10 lg:p-12">
        <div className="max-w-xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><Check size={14} /> Workspace ready</div>
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-3xl">A foundation built to grow.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-500">Your secure workspace is set up. Add the tools your sales team needs, when you're ready.</p>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 hidden size-72 rounded-full border-[32px] border-slate-50 md:block" />
      </section>

      {user?.isSuperAdmin && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link to="/users" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Users size={20} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Team members</span><span className="mt-1 block text-xs leading-5 text-slate-500">Manage people and their access</span></span>
            <ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-slate-900" />
          </Link>
          <Link to="/roles" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Shield size={20} strokeWidth={1.8} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Roles & access</span><span className="mt-1 block text-xs leading-5 text-slate-500">Control who can do what</span></span>
            <ArrowUpRight size={17} className="text-slate-400 transition group-hover:text-slate-900" />
          </Link>
        </div>
      )}
    </div>
  );
}
