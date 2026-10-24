// Supabase Edge Function: instagram-sync
// Copia do Instagram da loja para o site: seguidores, seguindo, publicações e os stories das últimas 24 h.
// Roda sozinha a cada 15 min (pg_cron) e quando o admin aperta "Atualizar tudo".
//
// O token fica na tabela instagram_config (só o servidor lê). O admin cola o token no painel.
// Tokens do Instagram duram 60 dias; esta função renova o token toda semana sozinha.
// Deploy: verify_jwt = false (não mexe em nada sensível; tem trava de 1 minuto entre execuções).

import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH = 'https://graph.instagram.com/v21.0';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const milhar = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: cfg } = await db.from('instagram_config').select('*').eq('id', 1).maybeSingle();
  let token: string | undefined = cfg?.access_token || Deno.env.get('IG_ACCESS_TOKEN') || undefined;
  if (!token) return json({ ok: false, configured: false, message: 'Instagram ainda não conectado' });

  const { data: prof } = await db.from('store_profile').select('stats, instagram_synced_at').eq('id', 1).maybeSingle();
  const force = new URL(req.url).searchParams.get('force') === '1';
  if (!force && prof?.instagram_synced_at && Date.now() - new Date(prof.instagram_synced_at).getTime() < 60_000) {
    return json({ ok: true, skipped: true, message: 'Atualizado há menos de 1 minuto' });
  }

  // Renova o token uma vez por semana (vale 60 dias)
  const refreshedAt = cfg?.token_refreshed_at ? new Date(cfg.token_refreshed_at).getTime() : 0;
  if (cfg && Date.now() - refreshedAt > 7 * 24 * 3600_000) {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`).then(r => r.json()).catch(() => null);
    if (r?.access_token) {
      token = r.access_token;
      await db.from('instagram_config').update({ access_token: token, token_refreshed_at: new Date().toISOString() }).eq('id', 1);
    }
  }

  const me = await fetch(`${GRAPH}/me?fields=user_id,username,followers_count,follows_count,media_count&access_token=${token}`).then(r => r.json()).catch(() => null);
  if (!me || me.error) {
    const message = me?.error?.message || 'Não consegui falar com o Instagram';
    await db.from('instagram_config').update({ last_error: message, last_run_at: new Date().toISOString() }).eq('id', 1);
    return json({ ok: false, configured: true, message });
  }

  const st = await fetch(`${GRAPH}/me/stories?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}`).then(r => r.json()).catch(() => null);
  const now = new Date();
  const stories = (st?.data || [])
    .map((s: Record<string, string>) => ({
      id: s.id,
      media_type: s.media_type,
      media_url: s.media_url || s.thumbnail_url,
      permalink: s.permalink || null,
      taken_at: s.timestamp,
      expires_at: new Date(new Date(s.timestamp).getTime() + 24 * 3600_000).toISOString(),
      synced_at: now.toISOString(),
    }))
    .filter((s: { media_url?: string }) => !!s.media_url);

  if (stories.length) await db.from('instagram_stories').upsert(stories);
  if (st && !st.error) {
    // Some do site o que expirou ou foi apagado no Instagram
    const ids = stories.map((s: { id: string }) => s.id);
    const del = db.from('instagram_stories').delete();
    await (ids.length ? del.not('id', 'in', `(${ids.map((i: string) => `"${i}"`).join(',')})`) : del.neq('id', ''));
  }
  await db.from('instagram_stories').delete().lt('expires_at', now.toISOString());

  const stats = {
    ...(prof?.stats || {}),
    posts: me.media_count ?? prof?.stats?.posts,
    followers: me.followers_count != null ? milhar(me.followers_count) : prof?.stats?.followers,
    following: me.follows_count ?? prof?.stats?.following,
  };
  await db.from('store_profile').update({ stats, instagram_synced_at: now.toISOString() }).eq('id', 1);
  await db.from('instagram_config').update({ last_error: null, last_run_at: now.toISOString(), username: me.username || null }).eq('id', 1);

  return json({ ok: true, stories: stories.length, followers: me.followers_count, username: me.username });
});
