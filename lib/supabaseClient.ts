import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://eiskjmxbwmqsdgzpeaxt.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_Vavj1IUtf_Vw_e7HrO5veA_nQc-gcI7";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
