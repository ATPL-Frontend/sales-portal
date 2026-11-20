import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Brand } from '../../components/ui/Brand';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 px-5 py-7 sm:px-10 sm:py-9">
      <div className="flex items-center justify-between"><Brand /><ThemeToggle /></div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[420px] rounded-3xl border border-slate-200 bg-white px-7 py-10 shadow-lg sm:px-10 sm:py-12">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800"><LockKeyhole size={21} strokeWidth={1.8}/></div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to your Ampec workspace.</p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <Field id="email" label="Email address" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)} required />
            <label htmlFor="password" className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <span className="relative block">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`${inputClass} pr-12`} placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              </span>
            </label>
            {error && <Notice message={error} />}
            <Button type="submit" className="mt-2 w-full justify-between" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17}/>
            </Button>
          </form>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">Ampec Technologies · Internal workspace</p>
    </div>
  );
}
