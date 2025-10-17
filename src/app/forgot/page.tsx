'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const sb = supabaseClient();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('Sending reset email…');
    try {
      const redirectTo = `${window.location.origin}/reset`;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        // Handle rate limit error with a friendly message
        if (error.message.includes('rate limit')) {
          setMsg('Please wait 60 seconds before requesting another password reset.');
        } else {
          setMsg(error.message);
        }
      } else {
        setMsg('If that email exists, a reset link has been sent.');
      }
    } catch (e) {
      const errMsg = (e as Error).message;
      if (errMsg.includes('rate limit')) {
        setMsg('Please wait 60 seconds before requesting another password reset.');
      } else {
        setMsg(errMsg);
      }
    } finally {
      setBusy(false);
    }
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

          <CardTitle className="text-2xl font-bold -mt-6">Forgot your password?</CardTitle>
          <CardDescription className="text-base">
            Enter your email and we'll send you a reset link.
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

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all cursor-pointer"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Sending…
                </div>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          {msg && (
            <div className={`text-sm p-3 rounded-md ${
              msg.includes('sent')
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {msg}
            </div>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              ← Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

