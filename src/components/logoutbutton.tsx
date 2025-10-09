"use client";

import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // Send them to the public login page
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
      aria-label="Log out"
    >
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
