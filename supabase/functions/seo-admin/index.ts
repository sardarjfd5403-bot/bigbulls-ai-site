import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SITE_ORIGIN = "https://bigbullsglobalmarket.is-an.ai";
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const required = (v: string | undefined, label: string) => {
  if (!v) throw new Error(label + " is not configured.");
  return v;
};

const b64url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const utf8b64url = (value: string) => b64url(new TextEncoder().encode(value));
const googleAccessToken = async () => {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret is not configured in Supabase.");
  let account: any;
  try { account = JSON.parse(raw); } catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must contain the complete service-account JSON key."); }
  if (!account.client_email || !account.private_key) throw new Error("Google service-account JSON is missing client_email or private_key.");
  const now = Math.floor(Date.now() / 1000);
  const header = utf8b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = utf8b64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claim;
  const pem = String(account.private_key).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const assertion = unsigned + "." + b64url(signature);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error("Google OAuth token exchange failed: " + (tokenData.error_description || tokenData.error || "Unknown error"));
  return { token: tokenData.access_token as string, email: account.client_email as string };
};
const gscQuery = async (token: string, dimension: "page" | "query", startDate: string, endDate: string) => {
  const site = encodeURIComponent(SITE_ORIGIN + "/");
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites/" + site + "/searchAnalytics/query", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions: [dimension], rowLimit: 1000, dataState: "final" })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Search Console API (" + response.status + "): " + (data?.error?.message || "Request failed. Check property access and API enablement."));
  return (data.rows || []).map((row: any) => ({
    data_date: endDate, dimension_type: dimension, dimension_value: String(row.keys?.[0] || ""),
    clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0), average_position: Number(row.position || 0), updated_at: new Date().toISOString()
  })).filter((row: any) => row.dimension_value);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("origin") && req.headers.get("origin") !== SITE_ORIGIN) return reply({ error: "Origin not allowed." }, 403);
  if (req.method !== "POST") return reply({ error: "POST required." }, 405);
  try {
    const url = required(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    const bearer = req.headers.get("Authorization") || "";
    const token = bearer.replace(/^Bearer\s+/i, "");
    if (!token || !anon) return reply({ error: "Sign in as an administrator." }, 401);
    const auth = createClient(url, required(anon, "SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + token } }
    });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Invalid or expired session." }, 401);
    const { data: isAdmin, error: roleError } = await auth.rpc("is_bigbulls_admin");
    if (roleError) throw roleError;
    if (isAdmin !== true) return reply({ error: "Administrator permission required." }, 403);

    const db = createClient(url, required(secret, "SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "dashboard");

    const count = async (table: string, apply?: (q: any) => any) => {
      let q = db.from(table).select("id", { count: "exact", head: true });
      if (apply) q = apply(q);
      const { count: n, error } = await q;
      if (error) throw error;
      return n || 0;
    };
    const dashboard = async () => {
      const now = Date.now();
      const since24 = new Date(now - 86400000).toISOString();
      const since7 = new Date(now - 7 * 86400000).toISOString();
      const since30 = new Date(now - 30 * 86400000).toISOString();
      const [
        views24, views7, views30, clicks30, signups30, conversions30,
        registrations, deposits, withdrawals, pendingOrders, executedOrders,
        activeTraders, events, settings, keywords, pages, cards
      ] = await Promise.all([
        count("bb_site_events", q => q.eq("event_name", "page_view").gte("created_at", since24)),
        count("bb_site_events", q => q.eq("event_name", "page_view").gte("created_at", since7)),
        count("bb_site_events", q => q.eq("event_name", "page_view").gte("created_at", since30)),
        count("bb_site_events", q => q.eq("event_name", "click").gte("created_at", since30)),
        count("bb_site_events", q => q.eq("event_name", "signup").gte("created_at", since30)),
        count("bb_site_events", q => q.eq("event_name", "conversion").gte("created_at", since30)),
        count("profiles"),
        count("wallet_transactions", q => q.eq("kind", "deposit")),
        count("wallet_transactions", q => q.eq("kind", "withdrawal")),
        count("bb_trade_orders", q => q.in("status", ["RECEIVED", "PENDING"])),
        count("bb_trade_orders", q => q.eq("status", "FILLED")),
        count("bb_trade_positions", q => q.eq("status", "OPEN")),
        db.from("bb_site_events").select("path,event_name,session_id,created_at").gte("created_at", since30).limit(5000),
        db.from("bb_seo_settings").select("*").eq("singleton", true).single(),
        db.from("bb_seo_keywords").select("*").order("updated_at", { ascending: false }).limit(100),
        db.from("bb_seo_pages").select("*").order("seo_score", { ascending: true }).limit(100),
        db.from("bb_seo_cards").select("*").order("created_at", { ascending: false }).limit(50)
      ]);
      for (const x of [events, settings, keywords, pages, cards]) if (x.error) throw x.error;
      const today = await Promise.all([
        count("profiles", q => q.gte("created_at", since24)),
        count("wallet_transactions", q => q.eq("kind", "deposit").gte("created_at", since24)),
        count("wallet_transactions", q => q.eq("kind", "withdrawal").gte("created_at", since24)),
        count("bb_trade_orders", q => q.in("status", ["RECEIVED", "PENDING"]).gte("created_at", since24)),
        count("bb_trade_orders", q => q.eq("status", "FILLED").gte("created_at", since24))
      ]);

      const gscResult = await db.from("bb_gsc_search_rows").select("*").order("data_date", { ascending: false }).limit(2000);
      if (gscResult.error) throw gscResult.error;
      const latestGscDate = gscResult.data?.[0]?.data_date || null;
      const latestGsc = (gscResult.data || []).filter((row: any) => row.data_date === latestGscDate);
      const gscPages = latestGsc.filter((row: any) => row.dimension_type === "page");
      const gscQueries = latestGsc.filter((row: any) => row.dimension_type === "query");
      const gscTotals = gscPages.reduce((sum: any, row: any) => ({
        clicks: sum.clicks + Number(row.clicks || 0),
        impressions: sum.impressions + Number(row.impressions || 0),
        weightedPosition: sum.weightedPosition + Number(row.average_position || 0) * Number(row.impressions || 0)
      }), { clicks: 0, impressions: 0, weightedPosition: 0 });
\n      const eventRows = events.data || [];
      const uniqueSessions = new Set(eventRows.filter((e: any) => e.event_name === "page_view" && e.session_id).map((e: any) => e.session_id)).size;
      const pageViews = new Map<string, number>();
      for (const e of eventRows) if (e.event_name === "page_view") pageViews.set(e.path, (pageViews.get(e.path) || 0) + 1);
      const topPages = [...pageViews.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, views]) => ({ path, views }));
      return {
        generated_at: new Date().toISOString(),
        traffic: { page_views_24h: views24, page_views_7d: views7, page_views_30d: views30, clicks_30d: clicks30, signups_30d: signups30, conversions_30d: conversions30, unique_sessions_30d: uniqueSessions, top_pages_30d: topPages },
        clients: { total_registrations: registrations, registrations_24h: today[0] },
        finance: { deposit_requests: deposits, withdrawal_requests: withdrawals, deposit_requests_24h: today[1], withdrawal_requests_24h: today[2], source: "wallet_transactions" },
        trading: { pending_orders: pendingOrders, filled_orders: executedOrders, pending_orders_24h: today[3], filled_orders_24h: today[4], active_positions: activeTraders, source: "bb_trade_orders / bb_trade_positions" },
        integrations: { gemini_model_configured: !!Deno.env.get("GEMINI_API_KEY"), openai_model_configured: !!Deno.env.get("OPENAI_API_KEY"), google_service_account_configured: !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"), search_console_connected: settings.data?.google_search_console_connected === true },\n        search_console: { connected: settings.data?.google_search_console_connected === true, last_sync_date: latestGscDate, clicks_28d: gscTotals.clicks, impressions_28d: gscTotals.impressions, ctr_28d: gscTotals.impressions ? gscTotals.clicks / gscTotals.impressions : 0, average_position_28d: gscTotals.impressions ? gscTotals.weightedPosition / gscTotals.impressions : null, top_queries: gscQueries.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,10), top_pages: gscPages.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,10) },
        seo: { settings: settings.data, keywords: keywords.data || [], pages: pages.data || [], cards: cards.data || [] },
        note: "Counts are read from recorded Supabase rows. Traffic tracking begins after the tracker is deployed; search impressions and keyword rankings require Google Search Console connection."
      };
    };


    if (action === "sync_search_console") {
      const { token, email } = await googleAccessToken();
      const propertyUrl = SITE_ORIGIN + "/";
      const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: "Bearer " + token } });
      const sitesData = await sitesResponse.json();
      if (!sitesResponse.ok) throw new Error("Could not list Search Console properties: " + (sitesData?.error?.message || "Google API error."));
      const property = (sitesData.siteEntry || []).find((item: any) => item.siteUrl === propertyUrl);
      if (!property) throw new Error("Service account " + email + " does not have access to " + propertyUrl + ". Add it in Search Console > Settings > Users and permissions, then retry.");
      const end = new Date(Date.now() - 3 * 86400000);
      const start = new Date(end.getTime() - 27 * 86400000);
      const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
      const startDate = dateOnly(start), endDate = dateOnly(end);
      const [pageRows, queryRows] = await Promise.all([
        gscQuery(token, "page", startDate, endDate),
        gscQuery(token, "query", startDate, endDate)
      ]);
      const rows = [...pageRows, ...queryRows];
      if (rows.length) {
        const { error } = await db.from("bb_gsc_search_rows").upsert(rows, { onConflict: "data_date,dimension_type,dimension_value" });
        if (error) throw error;
      }
      for (const row of pageRows) {
        let path = "/";
        try { path = new URL(row.dimension_value).pathname || "/"; } catch { continue; }
        const { error } = await db.from("bb_seo_pages").upsert({
          path, search_clicks: row.clicks, search_impressions: row.impressions,
          ctr: row.ctr, average_position: row.average_position, updated_at: new Date().toISOString()
        }, { onConflict: "path" });
        if (error) throw error;
      }
      for (const row of queryRows) {
        const { data: existing } = await db.from("bb_seo_keywords").select("id").eq("keyword", row.dimension_value).maybeSingle();
        if (existing?.id) {
          const { error } = await db.from("bb_seo_keywords").update({ current_position: row.average_position, source: "google_search_console", updated_at: new Date().toISOString() }).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("bb_seo_keywords").insert({
            keyword: row.dimension_value, intent: "informational", source: "google_search_console",
            current_position: row.average_position, status: "tracking",
            notes: "GSC 28-day clicks: " + row.clicks + "; impressions: " + row.impressions
          });
          if (error && error.code !== "23505") throw error;
        }
      }
      const { error: settingError } = await db.from("bb_seo_settings").update({
        google_search_console_connected: true, updated_at: new Date().toISOString(), updated_by: authData.user.id
      }).eq("singleton", true);
      if (settingError) throw settingError;
      await db.from("bb_seo_activity").insert({
        event_type: "GOOGLE_SEARCH_CONSOLE_SYNCED", actor_user_id: authData.user.id,
        details: { property: propertyUrl, service_account: email, start_date: startDate, end_date: endDate, page_rows: pageRows.length, query_rows: queryRows.length }
      });
      return reply({ success: true, property: propertyUrl, start_date: startDate, end_date: endDate, page_rows: pageRows.length, query_rows: queryRows.length });
    }

    if (action === "dashboard") return reply(await dashboard());

    if (action === "assistant") {
      const question = String(body.question || "").trim().slice(0, 1000);
      if (!question) return reply({ error: "Ask a business question." }, 400);
      const facts = await dashboard();
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (apiKey) {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text:
              "You are BIGBULLS FX Market's admin intelligence assistant. Answer ONLY from this verified database snapshot. Never invent, estimate, extrapolate, or modify financial facts. Distinguish deposits from withdrawals and pending orders from filled orders. Do not approve, reject, transfer, credit, or perform financial actions. Clearly say when metrics are unavailable. Keep concise.\n\nQuestion: " + question + "\n\nDatabase snapshot JSON: " + JSON.stringify(facts)
            }]}],
            generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
          })
        });
        const data = await response.json();
        if (!response.ok) return reply({ error: "Gemini request failed.", detail: data?.error?.message || "Unknown provider error." }, 502);
        const answer = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
        return reply({ answer: answer || "Gemini returned no text.", facts, ai_model: true, provider: "Gemini" });
      }
      return reply({
        answer: "Gemini API key is not configured yet. Here is the verified live database snapshot; no figures have been estimated.",
        facts,
        ai_model: false
      });
    }



    if (action === "generate_seo_draft") {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) return reply({ error: "GEMINI_API_KEY is not configured in Supabase Edge Function Secrets." }, 423);
      const title = String(body.title || "").trim().slice(0, 180);
      const keyword = String(body.focus_keyword || "").trim().slice(0, 180);
      const pagePath = String(body.page_path || "/insights.html").slice(0, 500);
      if (!title || !keyword) return reply({ error: "Article title and focus keyword are required." }, 400);
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text:
            "Create a useful, original, search-friendly educational article draft for BIGBULLS FX Market. Do not promise profits, guaranteed returns, win rates, or risk-free trading. Do not invent current prices, market events, statistics, regulations, broker licenses, spreads, or facts about the company. Explain trading risk responsibly. Focus keyword: " + keyword + ". Working title: " + title + ". Return ONLY valid JSON with keys title, slug, excerpt, content. Slug must be lowercase ASCII words separated by hyphens. Content should be readable plain text with clear section headings, around 500-700 words, naturally use the focus keyword without keyword stuffing. The content is educational, not financial advice."
          }]}],
          generationConfig: { temperature: 0.45, maxOutputTokens: 1800, responseMimeType: "application/json" }
        })
      });
      const result = await response.json();
      if (!response.ok) return reply({ error: "Gemini content generation failed.", detail: result?.error?.message || "Unknown provider error." }, 502);
      const raw = result.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      let draft: any;
      try { draft = JSON.parse(raw); } catch { return reply({ error: "Gemini response was not valid JSON. Try again." }, 502); }
      const cleanTitle = String(draft.title || title).trim().slice(0, 180);
      const slug = String(draft.slug || cleanTitle.toLowerCase()).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
      const content = String(draft.content || "").trim().slice(0, 30000);
      const excerpt = String(draft.excerpt || "").trim().slice(0, 400);
      if (!slug || !content) return reply({ error: "Gemini did not return a complete article draft." }, 502);
      const { data, error } = await db.from("bb_seo_cards").upsert({
        title: cleanTitle, slug, content, excerpt, focus_keyword: keyword,
        page_path: pagePath, status: "draft", generated_by: "gemini-2.5-flash",
        updated_at: new Date().toISOString()
      }, { onConflict: "slug" }).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_CARD_AI_DRAFT_GENERATED", actor_user_id: authData.user.id, details: { card_id: data.id, slug, provider: "Gemini" } });
      return reply({ card: data, provider: "Gemini", model: "gemini-2.5-flash" });
    }

    if (action === "audit_pages") {
      const paths = ["/", "/accounts.html", "/platforms.html", "/education.html", "/partners.html", "/insights.html"];
      const existing = await db.from("bb_seo_pages").select("path,focus_keyword").in("path", paths);
      if (existing.error) throw existing.error;
      const focus = new Map((existing.data || []).map((p: any) => [p.path, p.focus_keyword]));
      const results = await Promise.all(paths.map(async (path) => {
        const notes: string[] = [];
        let html = "";
        let status = 0;
        try {
          const response = await fetch(SITE_ORIGIN + path, { headers: { "User-Agent": "BIGBULLS-SEO-Audit/1.0" } });
          status = response.status;
          if (!response.ok) throw new Error("HTTP " + response.status);
          html = await response.text();
        } catch (e) {
          notes.push("Page could not be fetched from the live domain: " + (e instanceof Error ? e.message : "fetch failed"));
        }
        const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
        const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] || "").trim();
        const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+["']/i.test(html);
        const h1 = (html.match(/<h1\b/gi) || []).length;
        const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
        const schema = /application\/ld\+json/i.test(html);
        const internalLinks = (html.match(/href=["'](?:\/|https:\/\/bigbullsglobalmarket\.is-an\.ai\/)[^"']*["']/gi) || []).length;
        const plain = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const words = plain ? plain.split(" ").length : 0;
        let score = 0;
        if (title.length >= 30 && title.length <= 65) score += 15; else notes.push("Title should be approximately 30–65 characters.");
        if (description.length >= 70 && description.length <= 160) score += 15; else notes.push("Meta description should be approximately 70–160 characters.");
        if (canonical) score += 10; else notes.push("Canonical URL is missing.");
        if (h1 === 1) score += 15; else notes.push("Use exactly one descriptive H1 heading.");
        if (viewport) score += 10; else notes.push("Viewport meta tag is missing.");
        if (schema) score += 10; else notes.push("Add relevant structured data where appropriate.");
        if (internalLinks >= 3) score += 10; else notes.push("Add useful internal links to related pages.");
        if (words >= 250) score += 15; else notes.push("Page content may be thin; add useful original information.");
        if (status === 200) score += 10;
        const row = {
          path, page_title: title, meta_description: description, focus_keyword: focus.get(path) || null,
          seo_score: score, index_status: "unknown", audit_notes: notes, updated_at: new Date().toISOString()
        };
        const { error } = await db.from("bb_seo_pages").upsert(row, { onConflict: "path" });
        if (error) throw error;
        return { path, http_status: status, seo_score: score, title, description, words, notes };
      }));
      await db.from("bb_seo_activity").insert({ event_type: "SEO_SITE_AUDIT_COMPLETED", actor_user_id: authData.user.id, details: { pages: results.length, average_score: Math.round(results.reduce((n, p) => n + p.seo_score, 0) / results.length) } });
      return reply({ results, generated_at: new Date().toISOString() });
    }

    if (action === "save_settings") {
      if (body.ai_enabled === true && !Deno.env.get("GEMINI_API_KEY")) return reply({ error: "GEMINI_API_KEY is not configured; AI optimization cannot be enabled yet." }, 423);
      if (body.auto_publish_enabled === true && (!Deno.env.get("GEMINI_API_KEY") || body.search_console_connected !== true)) return reply({ error: "Automatic publishing requires Gemini and Search Console integration." }, 423);
      const patch = {
        ai_enabled: body.ai_enabled === true,
        publishing_enabled: body.publishing_enabled === true,
        auto_publish_enabled: body.auto_publish_enabled === true,
        max_daily_posts: Math.max(0, Math.min(5, Number(body.max_daily_posts ?? 1))),
        updated_at: new Date().toISOString(),
        updated_by: authData.user.id
      };
      const { data, error } = await db.from("bb_seo_settings").update(patch).eq("singleton", true).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_SETTINGS_UPDATED", actor_user_id: authData.user.id, details: patch });
      return reply({ settings: data });
    }

    if (action === "save_keyword") {
      const keyword = String(body.keyword || "").trim().slice(0, 180);
      if (!keyword) return reply({ error: "Keyword is required." }, 400);
      const row = {
        keyword,
        intent: ["informational","commercial","navigational","transactional"].includes(body.intent) ? body.intent : "informational",
        source: String(body.source || "manual").slice(0, 60),
        target_path: String(body.target_path || "/").slice(0, 500),
        status: ["research","targeting","tracking","paused"].includes(body.status) ? body.status : "research",
        updated_at: new Date().toISOString()
      };
      const { data, error } = await db.from("bb_seo_keywords").upsert(row, { onConflict: "keyword" }).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_KEYWORD_SAVED", actor_user_id: authData.user.id, details: { keyword } });
      return reply({ keyword: data });
    }

    if (action === "save_card") {
      const title = String(body.title || "").trim().slice(0, 180);
      const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
      const content = String(body.content || "").trim().slice(0, 30000);
      if (!title || !slug || !content) return reply({ error: "Title, slug and content are required." }, 400);
      const row = {
        title, slug, content,
        excerpt: String(body.excerpt || "").slice(0, 400),
        focus_keyword: String(body.focus_keyword || "").slice(0, 180),
        page_path: String(body.page_path || "/").slice(0, 500),
        status: "draft",
        generated_by: "admin_editor",
        updated_at: new Date().toISOString()
      };
      const { data, error } = await db.from("bb_seo_cards").upsert(row, { onConflict: "slug" }).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_CARD_DRAFT_SAVED", actor_user_id: authData.user.id, details: { card_id: data.id, slug } });
      return reply({ card: data });
    }

    if (action === "publish_card") {
      const id = String(body.id || "");
      const { data: settings, error: settingsError } = await db.from("bb_seo_settings").select("*").eq("singleton", true).single();
      if (settingsError) throw settingsError;
      if (settings.publishing_enabled !== true) return reply({ error: "Publishing is paused in Admin SEO settings." }, 423);
      const { data, error } = await db.from("bb_seo_cards").update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_CARD_PUBLISHED", actor_user_id: authData.user.id, details: { card_id: id, slug: data.slug } });
      return reply({ card: data });
    }

    if (action === "save_page") {
      const path = String(body.path || "/").trim().slice(0, 500);
      if (!path.startsWith("/")) return reply({ error: "Page path must start with /." }, 400);
      const row = {
        path,
        page_title: String(body.page_title || "").slice(0, 180),
        meta_description: String(body.meta_description || "").slice(0, 320),
        focus_keyword: String(body.focus_keyword || "").slice(0, 180),
        seo_score: Math.max(0, Math.min(100, Number(body.seo_score || 0))),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await db.from("bb_seo_pages").upsert(row, { onConflict: "path" }).select("*").single();
      if (error) throw error;
      await db.from("bb_seo_activity").insert({ event_type: "SEO_PAGE_AUDIT_SAVED", actor_user_id: authData.user.id, details: { path, seo_score: row.seo_score } });
      return reply({ page: data });
    }

    return reply({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("seo-admin:", error);
    return reply({ error: error instanceof Error ? error.message : "SEO Admin error." }, 500);
  }
});
