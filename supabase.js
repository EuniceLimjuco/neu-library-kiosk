import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uzwiqnfntkjmksbxxdzt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6d2lxbmZudGtqbWtzYnh4ZHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc0NjIsImV4cCI6MjA4OTYwMzQ2Mn0.HVJWOdlw3esJCkejMyspruBjNt01NZygO-HHbJZispE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);