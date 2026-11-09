import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("OTP_FROM_EMAIL") || "BIGBULLS Security <security@bigbullsfxmarket.com>";
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user?.email) return json({ error: "Verified login email is required" }, 401);

  const admin = createClient(url, serviceKey);
  let body: { action?: string; transaction_id?: string; otp?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const transactionId = String(body.transaction_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(transactionId)) return json({ error: "Invalid request reference" }, 400);

  const { data: tx, error: txError } = await admin.from("wallet_transactions")
    .select("id,user_id,kind,status,account_id,amount_usd,asset,network,destination_address,invoice_id,otp_verified_at")
    .eq("id", transactionId).eq("user_id", user.id).single();
  if (txError || !tx || tx.kind !== "withdrawal" || !tx.account_id || !["pending", "otp_pending"].includes(tx.status))
    return json({ error: "Withdrawal request not found or not eligible" }, 404);

  if (body.action === "request") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentChallenges, error: rateError } = await admin.from("withdrawal_otp_challenges")
      .select("id", { count: "exact", head: true }).eq("transaction_id", transactionId)
      .eq("user_id", user.id).gte("created_at", since);
    if (rateError) return json({ error: "Could not check OTP rate limit" }, 500);
    if ((recentChallenges || 0) >= 3) return json({ error: "OTP limit reached for this withdrawal. Try again in one hour." }, 429);
    const { count: userChallenges, error: userRateError } = await admin.from("withdrawal_otp_challenges")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if (userRateError) return json({ error: "Could not check account OTP rate limit" }, 500);
    if ((userChallenges || 0) >= 6) return json({ error: "Account OTP limit reached. Try again in one hour." }, 429);
    if (!resendKey) return json({ error: "Email OTP delivery is not configured. Admin must add RESEND_API_KEY." }, 503);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const otpHash = await sha256(`${transactionId}:${user.id}:${code}`);
    const { error: insertError } = await admin.from("withdrawal_otp_challenges").insert({
      transaction_id: transactionId, user_id: user.id, otp_hash: otpHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertError) return json({ error: "Could not create OTP challenge" }, 500);
    const { error: updateError } = await admin.from("wallet_transactions").update({ status: "otp_pending" })
      .eq("id", transactionId).eq("user_id", user.id).in("status", ["pending", "otp_pending"]);
    if (updateError) return json({ error: "Could not prepare withdrawal verification" }, 500);

    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail, to: [user.email], subject: "BIGBULLS withdrawal verification code",
        html: `<div style="font-family:Arial,sans-serif;background:#0b1424;color:#fff;padding:28px;border-radius:12px"><h2>BIGBULLS FX MARKET</h2><p>Your withdrawal verification code is:</p><div style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#e7bd55">${code}</div><p>Invoice: ${tx.invoice_id}</p><p>This code expires in 10 minutes. Never share it with anyone.</p></div>`,
      }),
    });
    if (!email.ok) {
      const { data: challenge } = await admin.from("withdrawal_otp_challenges").select("id")
        .eq("transaction_id", transactionId).eq("user_id", user.id).is("consumed_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (challenge) await admin.from("withdrawal_otp_challenges").delete().eq("id", challenge.id);
      await admin.from("wallet_transactions").update({ status: "pending" }).eq("id", transactionId).eq("user_id", user.id);
      return json({ error: "OTP email could not be sent. Check Resend domain/sender configuration." }, 502);
    }
    return json({ ok: true, message: "OTP sent to your registered email. It expires in 10 minutes." });
  }

  if (body.action === "verify") {
    const code = String(body.otp || "").trim();
    if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit email code" }, 400);
    const { data: challenge, error: challengeError } = await admin.from("withdrawal_otp_challenges")
      .select("*").eq("transaction_id", transactionId).eq("user_id", user.id).is("consumed_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (challengeError || !challenge) return json({ error: "OTP challenge not found. Request a new code." }, 404);
    if (new Date(challenge.expires_at).getTime() < Date.now()) return json({ error: "OTP expired. Request a new code." }, 400);
    if (challenge.attempts >= 5) return json({ error: "Too many attempts. Request a new code." }, 429);
    const supplied = await sha256(`${transactionId}:${user.id}:${code}`);
    if (supplied !== challenge.otp_hash) {
      await admin.from("withdrawal_otp_challenges").update({ attempts: challenge.attempts + 1 }).eq("id", challenge.id);
      return json({ error: "Incorrect OTP" }, 400);
    }
    const now = new Date().toISOString();
    const { error: consumeError } = await admin.from("withdrawal_otp_challenges").update({ consumed_at: now }).eq("id", challenge.id).is("consumed_at", null);
    if (consumeError) return json({ error: "OTP verification could not be completed" }, 500);
    const { error: verifiedError } = await admin.from("wallet_transactions").update({ otp_verified_at: now, status: "pending" })
      .eq("id", transactionId).eq("user_id", user.id).eq("status", "otp_pending");
    if (verifiedError) return json({ error: "Withdrawal verification could not be saved" }, 500);
    return json({ ok: true, message: "Email verified. Your withdrawal is now waiting for admin review." });
  }
  return json({ error: "Unknown action" }, 400);
});
