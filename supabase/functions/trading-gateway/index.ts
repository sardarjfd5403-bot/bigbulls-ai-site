import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(name + " is not configured in Edge Function secrets.");
  return value;
};
const LIVE_CHECKS = [
  "liquidity_verified",
  "settlement_verified",
  "regulatory_authorized",
  "client_funds_controls_verified",
  "reconciliation_verified",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const url = required(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || !anonKey) return json({ error: "Authentication required." }, 401);

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);
    const user = authData.user;

    const admin = createClient(url, required(serviceKey, "SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "accounts");

    if (action === "accounts") {
      const { data, error } = await admin.from("trading_accounts")
        .select("id,user_id,account_mode,account_number,display_name,account_type,platform,server_name,currency,balance,status,requested_leverage,archived_at,deleted_at,created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: control, error: controlError } = await admin.from("bb_execution_settings").select("demo_execution_enabled,live_execution_enabled,global_halt,halt_reason,live_readiness").eq("singleton", true).single();
      if (controlError) throw controlError;
      const checks = control.live_readiness || {};
      const missing = LIVE_CHECKS.filter(key => checks[key] !== true);
      const adapterReady = Deno.env.get("LIVE_EXECUTION_ADAPTER_READY") === "true";
      return json({
        accounts: data || [],
        active_modes: ["demo", "real"],
        execution: {
          demo_enabled: control.demo_execution_enabled === true && control.global_halt !== true,
          global_halt: control.global_halt === true,
          live_effective: control.live_execution_enabled === true && missing.length === 0 && adapterReady && control.global_halt !== true,
          live_status: control.live_execution_enabled === true && missing.length === 0 && adapterReady && control.global_halt !== true ? "ENABLED" : "LOCKED",
          halt_reason: control.halt_reason || null,
          risk_limits: {
            max_risk_per_trade_pct: Number(control.max_risk_per_trade_pct || 1),
            max_daily_loss_pct: Number(control.max_daily_loss_pct || 3),
            max_aggregate_risk_pct: Number(control.max_aggregate_risk_pct || 3),
            max_open_positions: Number(control.max_open_positions || 5),
            max_leverage: Number(control.max_leverage || 100)
          }
        },
        generated_at: new Date().toISOString()
      });
    }


    if (action === "place_order") {
      const accountId = String(body.account_id || "");
      const symbol = String(body.symbol || "").trim().toUpperCase();
      const side = String(body.side || "").toUpperCase();
      const orderType = String(body.order_type || "MARKET").toUpperCase();
      const quantity = Number(body.quantity);
      const referencePrice = Number(body.reference_price);
      const allowedTypes = ["MARKET","BUY_LIMIT","SELL_LIMIT","BUY_STOP","SELL_STOP"];
      if (!accountId || !/^[A-Z0-9._-]{3,24}$/.test(symbol) || !["BUY","SELL"].includes(side) ||
          !allowedTypes.includes(orderType) || !(quantity > 0 && quantity <= 1000000) ||
          !(referencePrice > 0 && Number.isFinite(referencePrice))) {
        return json({error:"Invalid order parameters. A positive reference price is required for server-side simulated matching."},400);
      }
      const {data: account,error: accountErr}=await admin.from("trading_accounts")
        .select("id,user_id,account_mode,balance,status,archived_at,deleted_at,currency")
        .eq("id",accountId).eq("user_id",user.id).maybeSingle();
      if(accountErr) throw accountErr;
      if(!account || account.status!=="approved" || account.archived_at || account.deleted_at)
        return json({error:"Trading account is not active."},403);
      const {data: cfg,error: cfgErr}=await admin.from("bb_execution_settings").select("demo_execution_enabled,global_halt").eq("singleton",true).single();
      if(cfgErr) throw cfgErr;
      if(cfg.global_halt===true || (account.account_mode==="demo" && cfg.demo_execution_enabled!==true))
        return json({error:"Execution is currently halted."},423);
      const isMarket=orderType==="MARKET";
      const now=new Date().toISOString();
      const orderInsert={
        account_id:account.id,user_id:user.id,account_mode:account.account_mode,
        symbol,side,order_type:orderType,quantity,requested_price:referencePrice,
        stop_price:body.stop_price==null?null:Number(body.stop_price),
        limit_price:body.limit_price==null?null:Number(body.limit_price),
        stop_loss:body.stop_loss==null?null:Number(body.stop_loss),
        take_profit:body.take_profit==null?null:Number(body.take_profit),
        trailing_distance:body.trailing_distance==null?0:Number(body.trailing_distance),
        status:isMarket?"RECEIVED":"PENDING",created_at:now,updated_at:now
      };
      const {data:order,error:orderErr}=await admin.from("bb_trade_orders").insert(orderInsert).select("*").single();
      if(orderErr) throw orderErr;
      let position=null,fill=null;
      if(isMarket){
        const {data:p,error:pErr}=await admin.from("bb_trade_positions").insert({
          account_id:account.id,user_id:user.id,account_mode:account.account_mode,order_id:order.id,
          symbol,side,quantity,entry_price:referencePrice,mark_price:referencePrice,
          stop_loss:orderInsert.stop_loss,take_profit:orderInsert.take_profit,
          trailing_distance:orderInsert.trailing_distance,status:"OPEN",unrealized_pnl:0,realized_pnl:0
        }).select("*").single();
        if(pErr) throw pErr;
        position=p;
        const {data:fl,error:flErr}=await admin.from("bb_trade_fills").insert({
          order_id:order.id,position_id:p.id,account_id:account.id,user_id:user.id,
          account_mode:account.account_mode,symbol,side,quantity,fill_price:referencePrice,
          spread_cost:0,commission:0,slippage:0
        }).select("*").single();
        if(flErr) throw flErr;
        fill=fl;
        const {error:upErr}=await admin.from("bb_trade_orders").update({status:"FILLED",updated_at:new Date().toISOString()}).eq("id",order.id);
        if(upErr) throw upErr;
      }
      let forwarding=null;
      if(account.account_mode==="real"){
        const {data:q,error:qErr}=await admin.from("bb_manual_forward_queue").insert({
          order_id:order.id,account_id:account.id,user_id:user.id,account_mode:"real",
          symbol,side,quantity,reference_price:referencePrice,status:"AWAITING_ADMIN"
        }).select("*").single();
        if(qErr) throw qErr;
        forwarding=q;
      }
      await admin.from("bb_trade_audit_events").insert({
        account_id:account.id,user_id:user.id,actor_user_id:user.id,account_mode:account.account_mode,
        event_type:isMarket?"SIMULATED_ORDER_FILLED":"SIMULATED_ORDER_PENDING",
        entity_type:"order",entity_id:order.id,
        details:{execution_model:"SERVER_SIMULATION",reference_price:referencePrice,manual_forward_required:account.account_mode==="real"}
      });
      return json({success:true,execution_model:"SERVER_SIMULATION",order,position,fill,manual_forward:forwarding});
    }

    const { data: isAdmin, error: adminError } = await authClient.rpc("is_bigbulls_admin");
    if (adminError) throw adminError;
    if (isAdmin !== true) return json({ error: "Administrator permission required." }, 403);

    const { data: settings, error: settingsError } = await admin.from("bb_execution_settings")
      .select("*").eq("singleton", true).single();
    if (settingsError) throw settingsError;
    const readiness = settings.live_readiness || {};
    const checks = Object.fromEntries(LIVE_CHECKS.map(key => [key, readiness[key] === true]));
    const missing = LIVE_CHECKS.filter(key => readiness[key] !== true);
    const adapterReady = Deno.env.get("LIVE_EXECUTION_ADAPTER_READY") === "true";
    const liveEffective = settings.live_execution_enabled === true && missing.length === 0 && adapterReady && settings.global_halt !== true;


    if (action === "manual_forward_queue") {
      const {data,error}=await admin.from("bb_manual_forward_queue").select("*").order("created_at",{ascending:false}).limit(300);
      if(error) throw error;
      return json({queue:data||[]});
    }
    if (action === "mark_order_forwarded") {
      const queueId=String(body.queue_id||"");
      const externalReference=String(body.external_reference||"").slice(0,160);
      if(!queueId) return json({error:"queue_id required"},400);
      const {data,error}=await admin.from("bb_manual_forward_queue").update({
        status:"FORWARDED",admin_note:String(body.admin_note||"").slice(0,500),
        external_reference:externalReference||null,forwarded_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq("id",queueId).eq("status","AWAITING_ADMIN").select("*").maybeSingle();
      if(error) throw error;
      if(!data) return json({error:"Queue item not found or already processed."},409);
      await admin.from("bb_trade_audit_events").insert({
        account_id:data.account_id,user_id:data.user_id,actor_user_id:user.id,account_mode:"real",
        event_type:"MANUAL_LIQUIDITY_FORWARD_RECORDED",entity_type:"order",entity_id:data.order_id,
        details:{queue_id:queueId,external_reference:externalReference||null}
      });
      return json({success:true,queue_item:data});
    }

    if (action === "client_dossier") {
      const lookup = String(body.lookup || "").trim();
      if (!lookup || lookup.length > 80) return json({ error: "Enter a valid client dossier number or trading account number." }, 400);
      let userId: string | null = null;
      if (/^\\d+$/.test(lookup)) {
        const dossier = await admin.from("bb_client_dossiers").select("user_id,dossier_number,folder_status,created_at").eq("dossier_number", Number(lookup)).maybeSingle();
        if (dossier.error) throw dossier.error;
        if (dossier.data) userId = dossier.data.user_id;
        if (!userId) {
          const account = await admin.from("trading_accounts").select("user_id").eq("account_number", Number(lookup)).is("deleted_at", null).limit(1).maybeSingle();
          if (account.error) throw account.error;
          userId = account.data?.user_id || null;
        }
      }
      if (!userId) return json({ error: "No client dossier found for that ID." }, 404);
      const [dossier, profile, accounts, transactions, paymentSubmissions, orders, positions, fills, audit] = await Promise.all([
        admin.from("bb_client_dossiers").select("dossier_number,folder_status,created_at,updated_at").eq("user_id", userId).maybeSingle(),
        admin.from("profiles").select("id,full_name,email,country,phone,account_type,status,created_at").eq("id", userId).maybeSingle(),
        admin.from("trading_accounts").select("id,account_mode,account_number,display_name,account_type,currency,balance,status,requested_leverage,created_at,archived_at,deleted_at").eq("user_id", userId).order("created_at", { ascending: false }),
        admin.from("wallet_transactions").select("id,account_id,kind,asset,network,amount_crypto,amount_usd,tx_hash,status,admin_note,created_at,completed_at,rejection_reason").eq("user_id", userId).order("created_at", { ascending: false }).limit(250),
        admin.from("payment_submissions").select("id,txid,status,submitted_at").eq("user_id", userId).order("submitted_at", { ascending: false }).limit(100),
        admin.from("bb_trade_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
        admin.from("bb_trade_positions").select("*").eq("user_id", userId).order("opened_at", { ascending: false }).limit(500),
        admin.from("bb_trade_fills").select("*").eq("user_id", userId).order("filled_at", { ascending: false }).limit(500),
        admin.from("bb_trade_audit_events").select("id,account_id,account_mode,event_type,entity_type,entity_id,details,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500)
      ]);
      const failure = [dossier,profile,accounts,transactions,paymentSubmissions,orders,positions,fills,audit].find(x => x.error);
      if (failure?.error) throw failure.error;
      return json({ dossier: dossier.data, profile: profile.data, accounts: accounts.data || [], wallet_transactions: transactions.data || [], payment_submissions: paymentSubmissions.data || [], orders: orders.data || [], positions: positions.data || [], fills: fills.data || [], audit_events: audit.data || [] });
    }

    if (action === "execution_status" || action === "admin_status") {
      const [accounts, orders, positions] = await Promise.all([
        admin.from("trading_accounts").select("id,account_mode,status", { count: "exact", head: true }),
        admin.from("bb_trade_orders").select("id", { count: "exact", head: true }),
        admin.from("bb_trade_positions").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
      ]);
      if (accounts.error || orders.error || positions.error) throw accounts.error || orders.error || positions.error;
      return json({
        execution: {
          demo_enabled: settings.demo_execution_enabled === true && settings.global_halt !== true,
          global_halt: settings.global_halt === true,
          live_configured: settings.live_execution_enabled === true,
          live_effective: liveEffective,
          live_status: liveEffective ? "ENABLED" : "LOCKED",
          adapter_ready: adapterReady,
          readiness: checks,
          missing_requirements: missing,
          halt_reason: settings.halt_reason || null,
          risk_limits: {
            max_risk_per_trade_pct: Number(settings.max_risk_per_trade_pct || 1),
            max_daily_loss_pct: Number(settings.max_daily_loss_pct || 3),
            max_aggregate_risk_pct: Number(settings.max_aggregate_risk_pct || 3),
            max_open_positions: Number(settings.max_open_positions || 5),
            max_leverage: Number(settings.max_leverage || 100)
          },
        },
        totals: { accounts: accounts.count || 0, orders: orders.count || 0, open_positions: positions.count || 0 },
      });
    }

    if (action === "set_global_risk") {
      const risk = {
        max_risk_per_trade_pct: Number(body.max_risk_per_trade_pct),
        max_daily_loss_pct: Number(body.max_daily_loss_pct),
        max_aggregate_risk_pct: Number(body.max_aggregate_risk_pct),
        max_open_positions: Number(body.max_open_positions),
        max_leverage: Number(body.max_leverage)
      };
      if (!(risk.max_risk_per_trade_pct > 0 && risk.max_risk_per_trade_pct <= 5 &&
            risk.max_daily_loss_pct > 0 && risk.max_daily_loss_pct <= 10 &&
            risk.max_aggregate_risk_pct >= risk.max_risk_per_trade_pct && risk.max_aggregate_risk_pct <= 15 &&
            Number.isInteger(risk.max_open_positions) && risk.max_open_positions >= 1 && risk.max_open_positions <= 100 &&
            Number.isInteger(risk.max_leverage) && risk.max_leverage >= 1 && risk.max_leverage <= 2000)) {
        return json({ error: "Risk settings are outside allowed server limits." }, 400);
      }
      const { error } = await admin.from("bb_execution_settings").update({
        ...risk, updated_at: new Date().toISOString(), updated_by: user.id
      }).eq("singleton", true);
      if (error) throw error;
      await admin.from("bb_trade_audit_events").insert({
        actor_user_id: user.id, event_type: "GLOBAL_RISK_LIMITS_UPDATED",
        entity_type: "execution_settings", details: risk
      });
      return json({ success: true, risk_limits: risk });
    }

    if (action === "set_global_halt") {
      const enabled = body.enabled === true;
      const reason = String(body.reason || (enabled ? "Administrator emergency halt" : "Administrator resumed demo execution")).slice(0, 300);
      const { error } = await admin.from("bb_execution_settings").update({
        global_halt: enabled,
        halt_reason: enabled ? reason : null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq("singleton", true);
      if (error) throw error;
      await admin.from("bb_trade_audit_events").insert({
        actor_user_id: user.id, event_type: enabled ? "GLOBAL_EXECUTION_HALT" : "GLOBAL_EXECUTION_RESUME",
        entity_type: "execution_settings", details: { reason },
      });
      return json({ success: true, global_halt: enabled, halt_reason: enabled ? reason : null });
    }

    if (action === "set_live_execution") {
      const enabled = body.enabled === true;
      if (!enabled) {
        const { error } = await admin.from("bb_execution_settings").update({
          live_execution_enabled: false, updated_at: new Date().toISOString(), updated_by: user.id,
        }).eq("singleton", true);
        if (error) throw error;
        await admin.from("bb_trade_audit_events").insert({ actor_user_id: user.id, event_type: "LIVE_EXECUTION_DISABLED", entity_type: "execution_settings" });
        return json({ success: true, live_effective: false, live_status: "LOCKED" });
      }
      if (missing.length || !adapterReady) {
        return json({
          error: "Live execution cannot be enabled. The server requires verified liquidity routing, settlement, regulatory authorization, client-funds controls, reconciliation, and a configured execution adapter.",
          code: "LIVE_READINESS_INCOMPLETE",
          missing_requirements: [...missing, ...(!adapterReady ? ["execution_adapter"] : [])],
        }, 423);
      }
      if (settings.global_halt === true) return json({ error: "Global execution halt is active.", code: "GLOBAL_HALT_ACTIVE" }, 423);
      const { error } = await admin.from("bb_execution_settings").update({
        live_execution_enabled: true, updated_at: new Date().toISOString(), updated_by: user.id,
      }).eq("singleton", true);
      if (error) throw error;
      await admin.from("bb_trade_audit_events").insert({ actor_user_id: user.id, event_type: "LIVE_EXECUTION_ENABLED", entity_type: "execution_settings" });
      return json({ success: true, live_effective: true, live_status: "ENABLED" });
    }

    if (action === "select_account") {
      const accountId = String(body.account_id || "");
      if (!accountId) return json({ error: "account_id is required." }, 400);
      const { data: account, error } = await admin.from("trading_accounts")
        .select("id,user_id,account_mode,account_number,display_name,currency,balance,status,requested_leverage,archived_at,deleted_at")
        .eq("id", accountId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!account || account.status !== "approved" || account.archived_at || account.deleted_at) return json({ error: "Account is not available for terminal access." }, 403);
      return json({ account });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("trading-gateway:", error);
    return json({ error: error instanceof Error ? error.message : "Trading gateway error." }, 500);
  }
});
