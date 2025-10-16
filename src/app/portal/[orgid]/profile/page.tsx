'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Plan = {
  tier: 'launch' | 'elevate' | 'maximize';
  percent: number;
};

type UserProperty = {
  id: string;
  property_id: string;
  property_name: string;
  property_address: string | null;
  airbnb_name: string | null;
  airbnb_url: string | null;
};

export default function ProfilePage() {
  const params = useParams<{ orgid: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const orgId = params?.orgid || '';
  const isProfilePage = pathname?.includes('/profile');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [properties, setProperties] = useState<UserProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogout = async () => {
    const sb = supabaseClient();
    await sb.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    async function loadProfile() {
      const sb = supabaseClient();
      const { data: { user } } = await sb.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Load profile
      const { data: profileData } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
      }

      // Load plan
      const planRes = await fetch(`/api/orgs/${orgId}/plan`);
      const planJson = await planRes.json();
      if (planJson.plan) {
        setPlan(planJson.plan);
      }

      // Load user properties with property details
      const { data: propsData } = await sb
        .from('user_properties')
        .select(`
          id,
          property_id,
          airbnb_name,
          airbnb_url,
          properties (
            name,
            address
          )
        `)
        .eq('user_id', user.id);

      if (propsData) {
        // Transform the data to flatten the properties object
        const transformedProps = propsData.map((up: any) => ({
          id: up.id,
          property_id: up.property_id,
          property_name: up.properties?.name || 'Unnamed Property',
          property_address: up.properties?.address || null,
          airbnb_name: up.airbnb_name,
          airbnb_url: up.airbnb_url,
        }));
        setProperties(transformedProps);
      }

      setLoading(false);
    }

    loadProfile();
  }, [orgId, router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        console.log('Avatar upload response:', data);
        // Add cache-busting timestamp to force image refresh
        const avatarUrlWithCache = `${data.avatar_url}?t=${Date.now()}`;
        setProfile(prev => prev ? { ...prev, avatar_url: avatarUrlWithCache } : null);
        setMessage('Avatar updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        console.error('Avatar upload error:', data);
        setMessage(`Failed to upload avatar: ${data.error || 'Unknown error'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Avatar upload exception:', error);
      setMessage('Failed to upload avatar: Network error');
      setTimeout(() => setMessage(''), 5000);
    }

    setUploading(false);
  }

  async function handleDeleteAvatar() {
    if (!confirm('Are you sure you want to delete your profile picture?')) return;

    setUploading(true);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
        setMessage('Avatar deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`Failed to delete avatar: ${data.error || 'Unknown error'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Avatar delete exception:', error);
      setMessage('Failed to delete avatar: Network error');
      setTimeout(() => setMessage(''), 5000);
    }

    setUploading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });

    if (res.ok) {
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, first_name: data.first_name, last_name: data.last_name } : null);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Failed to update profile');
    }

    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setChangingPassword(true);

    const sb = supabaseClient();
    const { data: { session } } = await sb.auth.getSession();

    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ new_password: newPassword }),
    });

    if (res.ok) {
      setMessage('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } else {
      const error = await res.json();
      setMessage(error.error || 'Failed to change password');
    }

    setChangingPassword(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const initials = (fullName || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F8F6F2] relative">

      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 animate-fade-in">
              {/* TruHost Logo */}
              <Image
                src="/truhost-logo.png"
                alt="TruHost Logo"
                width={380}
                height={106}
                className="h-20 w-auto object-contain transition-transform hover:scale-105"
                priority
              />
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Member Portal</p>
                {/* Pulsing green dot */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-2 h-2 rounded-full animate-ping opacity-75" style={{ backgroundColor: '#6b9b7a' }}></div>
                  <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: '#6b9b7a' }}></div>
                </div>
              </div>
            </div>

            {/* Toggle Navigation & Logout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`transition-all duration-300 ${!isProfilePage ? 'bg-primary text-foreground font-medium shadow-sm hover:bg-primary/80' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <Link href={`/portal/${orgId}`} className="flex items-center gap-2" prefetch={true}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`transition-all duration-300 ${isProfilePage ? 'bg-primary text-foreground font-medium shadow-sm hover:bg-primary/80' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <Link href={`/portal/${orgId}/profile`} className="flex items-center gap-2" prefetch={true}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                </Button>
              </div>

              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-border hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-all duration-300 cursor-pointer"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Message */}
        {message && (
          <Card className="mb-6 border-primary/20 bg-primary/5 animate-fade-in">
            <CardContent className="py-3">
              <p className="text-sm font-medium">{message}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Avatar Card */}
          <Card className="md:col-span-1 animate-fade-in">
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Upload your avatar</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                {/* Delete overlay on hover - only show if avatar exists */}
                {profile?.avatar_url && (
                  <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer">
                    <button
                      onClick={handleDeleteAvatar}
                      disabled={uploading}
                      className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="Delete avatar"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full">
                <label
                  htmlFor="avatar-upload"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 border-dashed border-border bg-background/50 hover:border-primary hover:bg-primary/5 transition-all duration-300 cursor-pointer group"
                >
                  <svg
                    className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {uploading ? 'Uploading...' : 'Choose Image'}
                  </span>
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Profile Info */}
          <Card className="md:col-span-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={saving} className="w-full cursor-pointer">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Current Plan */}
          <Card className="md:col-span-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Current Plan
              </CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </CardHeader>
            <CardContent>
              {plan ? (
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className="text-lg px-4 py-2 capitalize">{plan.tier}</Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      {plan.percent}% management fee on gross revenue
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No plan assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="md:col-span-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="mt-1"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="mt-1"
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={changingPassword} variant="secondary" className="w-full md:w-auto cursor-pointer">
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Assigned Properties */}
          <Card className="md:col-span-3 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Your Properties
              </CardTitle>
              <CardDescription>Airbnb listings assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No properties assigned yet</p>
              ) : (
                <div className="grid gap-3">
                  {properties.map((prop) => (
                    <div
                      key={prop.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-md transition-all bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold">{prop.property_name}</p>
                          {prop.property_address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {prop.property_address}
                            </p>
                          )}
                          {prop.airbnb_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Airbnb: {prop.airbnb_name}
                            </p>
                          )}
                          {prop.airbnb_url && (
                            <a
                              href={prop.airbnb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              View on Airbnb
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
