import { createClient } from '@supabase/supabase-js';

// Coloque os valores do SEU projeto no arquivo .env (veja .env.example)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env. O site vai usar só o cardápio padrão.');
}

export const supabase = createClient(
  supabaseUrl || 'https://exemplo.supabase.co',
  supabaseAnonKey || 'chave-ausente'
);
