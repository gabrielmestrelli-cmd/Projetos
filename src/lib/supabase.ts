import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mmrjdwoeibxynzdlvoxj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xItTVKpBhIkmB9NWLpCTyQ_YFa5WPbB';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
