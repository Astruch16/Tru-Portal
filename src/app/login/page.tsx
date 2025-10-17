'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

type Membership = { org_id: string; role: string | null };

function LoginForm() {
  const sb = supabaseClient();
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('Signing in…');

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); setBusy(false); return; }

    const { data, error: mErr } = await sb
      .from('org_memberships')
      .select('org_id, role')
      .limit(1);

    if (mErr) { setMsg(mErr.message); setBusy(false); return; }

    const orgId = (data && (data[0] as Membership | undefined)?.org_id) || '';
    setMsg('Signed in.');

    if (redirect) router.replace(redirect);
    else if (orgId) router.replace(`/portal/${orgId}`);
    else router.replace('/');

    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20 p-4 relative">

      <Card className="w-full max-w-md relative bg-card border-border shadow-xl">
        <CardHeader className="text-center pb-8">
          {/* House Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 transition-all duration-500 ease-in-out hover:scale-110 hover:rotate-3 hover:shadow-xl hover:shadow-primary/30 cursor-pointer">
            <svg className="w-10 h-10 text-primary-foreground transition-transform duration-500 ease-in-out" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>

          {/* TruHost Logo */}
          <div className="mx-auto flex items-center justify-center -mt-7">
            <Image
              src="/truhost-logo.png"
              alt="TruHost Logo"
              width={550}
              height={154}
              className="h-36 w-auto object-contain"
              priority
            />
          </div>

          <CardDescription className="text-base -mt-8">
            Property Management Portal
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all cursor-pointer"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in…
                </div>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {msg && (
            <div className={`text-sm p-3 rounded-md ${
              msg.includes('Signed in')
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {msg}
            </div>
          )}

          <div className="text-center">
            <a
              href="/forgot"
              className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Forgot your password?
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8F6F2] via-[#E1ECDB]/30 to-[#9db896]/20">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
