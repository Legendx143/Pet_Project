import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isDummyUrl =
  !supabaseUrl ||
  supabaseUrl.includes("dummy-project.supabase.co") ||
  supabaseUrl.includes("YOUR_PROJECT_REF") ||
  supabaseUrl.includes("example.com");

const isDummyKey =
  !supabasePublishableKey ||
  supabasePublishableKey.includes("dummy_publishable_key") ||
  supabasePublishableKey.includes("YOUR_KEY");

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey && !isDummyUrl && !isDummyKey
);

// The publishable key is safe to use in a browser. Never put a service-role key
// in a Vite environment variable because VITE_* values are sent to every user.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
