import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

export default function AuthCallback() {
  const [status, setStatus] = useState("Confirming your email…");

  useEffect(() => {
    let active = true;

    const finishConfirmation = async () => {
      if (!isSupabaseConfigured || !supabase) {
        window.location.replace("/");
        return;
      }

      try {
        // PKCE confirmations include a code. Implicit-flow confirmations are
        // detected by supabase-js when the client is created.
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Registration must return the person to the login page, not leave a
        // verification session active in their browser.
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/?emailConfirmed=1");
      } catch {
        if (active) {
          setStatus("We could not confirm that email. Please request a new confirmation link.");
        }
      }
    };

    finishConfirmation();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-callback-page">
      <p>{status}</p>
    </main>
  );
}
