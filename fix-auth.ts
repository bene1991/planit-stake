import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { config } from "npm:dotenv@16.4.5"; // Using compat import

async function check() {
  const env = config().parsed;
  if (!env) {
    console.error("No .env found relative to cwd");
    return;
  }
  
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if(!key) {
    console.log("No service role key");
    return;
  }

  const res = await fetch(`${url}/functions/v1/live-alerts-resolver`, {
     method: 'POST',
     headers: { Authorization: `Bearer ${key}` }
  });
  
  const text = await res.text();
  console.log("Response:", text);
}

check();
