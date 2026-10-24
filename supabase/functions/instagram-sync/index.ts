// Supabase Edge Function: instagram-sync
// Copia do Instagram da loja para o site: seguidores, seguindo, publicações e os stories das últimas 24 h.
// Roda sozinha a cada 15 min (pg_cron) e quando o admin aperta "Atualizar tudo".
//
// O token fica na tabela instagram_config (só o servidor lê). O admin cola o token no painel.
// Tokens do Instagram duram 60 dias; esta função renova o token toda semana sozinha.
// Chamada com a chave publishable (pública). Tem trava de 1 minuto entre execuções.

import postgres from 'npm:postgres@3.4.5';
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

  // Conexão direta com o banco (a variável SUPABASE_DB_URL já vem em toda Edge Function)
  const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });
  try {
    return await sync(req, sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
});

async function sync(req: Request, sql: ReturnType<typeof postgres>) {
  const [cfg] = await sql`select * from public.instagram_config where id = 1`;
  let token: string | undefined = cfg?.access_token || Deno.env.get('IG_ACCESS_TOKEN') || undefined;
  if (!token) return json({ ok: false, configured: false, message: 'Instagram ainda não conectado' });

  const [prof] = await sql`select stats, instagram_synced_at from public.store_profile where id = 1`;
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
      await sql`update public.instagram_config set access_token = ${token}, token_refreshed_at = now() where id = 1`;
    }
  }

  const me = await fetch(`${GRAPH}/me?fields=user_id,username,followers_count,follows_count,media_count&access_token=${token}`).then(r => r.json()).catch(() => null);
  if (!me || me.error) {
    const message = me?.error?.message || 'Não consegui falar com o Instagram';
    await sql`update public.instagram_config set last_error = ${message}, last_run_at = now() where id = 1`;
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

  for (const s of stories) {
    await sql`insert into public.instagram_stories (id, media_type, media_url, permalink, taken_at, expires_at, synced_at)
      values (${s.id}, ${s.media_type}, ${s.media_url}, ${s.permalink}, ${s.taken_at}, ${s.expires_at}, now())
      on conflict (id) do update set media_url = excluded.media_url, permalink = excluded.permalink, synced_at = now()`;
  }
  if (st && !st.error) {
    // Some do site o que foi apagado no Instagram
    const ids: string[] = stories.map((s: { id: string }) => s.id);
    if (ids.length) await sql`delete from public.instagram_stories where id <> all(${ids})`;
    else await sql`delete from public.instagram_stories`;
  }
  await sql`delete from public.instagram_stories where expires_at < now()`;

  const stats = {
    ...(prof?.stats || {}),
    posts: me.media_count ?? prof?.stats?.posts,
    followers: me.followers_count != null ? milhar(me.followers_count) : prof?.stats?.followers,
    following: me.follows_count ?? prof?.stats?.following,
  };
  await sql`update public.store_profile set stats = ${sql.json(stats)}, instagram_synced_at = now() where id = 1`;
  await sql`update public.instagram_config set last_error = null, last_run_at = now(), username = ${me.username || null} where id = 1`;

  return json({ ok: true, stories: stories.length, followers: me.followers_count, username: me.username });
}
