import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" }
});
const CONTRACT: Record<string,number> = { EURUSD:100000, GBPUSD:100000, XAUUSD:100 };
const PROVIDER_SYMBOL: Record<string,string> = { EURUSD:"EUR/USD", GBPUSD:"GBP/USD", XAUUSD:"XAU/USD" };
const roundDown = (n:number, step=0.01) => Math.floor((n + 1e-10) / step) * step;
const finite = (v:any) => Number.isFinite(Number(v));
const readinessKeys = ["liquidity_verified","settlement_verified","regulatory_authorized","client_funds_controls_verified","reconciliation_verified"];

Deno.serve(async (req:Request) => {
  if (req.method !== "POST") return json({error:"POST required"},405);
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY");
  if(!url||!anon||!service) return json({error:"Server configuration incomplete"},503);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:cronCfg,error:cronErr}=await db.from("bb_market_brain_config").select("cron_secret").eq("singleton",true).single();
    if(cronErr||!cronCfg?.cron_secret) return json({error:"Executor authentication configuration unavailable"},503);
    const supplied=req.headers.get("x-market-brain-cron-secret")||"";
    if(!supplied||supplied!==cronCfg.cron_secret) return json({error:"Unauthorized executor request"},401);

    const [{data:exec,error:execErr},{data:bbook,error:bbookErr},{data:optIns,error:optErr},{data:signals,error:signalErr}] = await Promise.all([
      db.from("bb_execution_settings").select("ai_auto_execution_enabled,global_halt,live_execution_enabled,live_readiness,max_risk_per_trade_pct,max_daily_loss_pct,max_aggregate_risk_pct,max_open_positions").eq("singleton",true).single(),
      db.from("bb_bbook_settings").select("enabled,max_open_positions,max_account_exposure").eq("singleton",true).single(),
      db.from("bb_ai_auto_trade_settings").select("user_id,account_id,risk_pct,reward_pct,max_daily_loss_pct").eq("enabled",true),
      db.from("bb_market_signal_feed").select("id,symbol,direction,score,signal_data,published,generated_at,expires_at").eq("published",true).order("generated_at",{ascending:false}).limit(20)
    ]);
    if(execErr||bbookErr||optErr||signalErr) throw execErr||bbookErr||optErr||signalErr;
    if(exec.ai_auto_execution_enabled!==true) return json({ok:true,paused:true,reason:"AI auto-execution master switch is OFF"});
    const readiness=exec.live_readiness||{};
    if(exec.global_halt===true||exec.live_execution_enabled!==true||readinessKeys.some(k=>readiness[k]!==true)||bbook.enabled!==true) {
      return json({ok:true,paused:true,reason:"B-Book execution or readiness gate is not green"});
    }
    if(!optIns?.length||!signals?.length) return json({ok:true,processed:0,reason:"No enabled account opt-ins or market signals"});

    const summary:any={attempted:0,opened:0,rejected:0,skipped:0,results:[]};
    const now=Date.now();
    const validSignals=signals.filter((s:any)=>{
      const d=s.signal_data||{};
      const age=now-Date.parse(s.generated_at);
      return ["BUY","SELL"].includes(String(s.direction).toUpperCase()) &&
        String(d.direction||"").toUpperCase()===String(s.direction).toUpperCase() &&
        Number(s.score)>=70 && d.data_status==="FRESH" && d.news_status==="FRESH" &&
        d.news_block!==true && finite(d.entry_low) && finite(d.entry_high) &&
        finite(d.stop_loss) && Date.parse(s.expires_at)>now &&
        Number.isFinite(age) && age>=0 && age<=5*60*1000;
    });

    for(const opt of optIns) for(const signal of validSignals) {
      summary.attempted++;
      const symbol=String(signal.symbol||"").toUpperCase().replaceAll("/","");
      const side=String(signal.direction).toUpperCase();
      const contract=CONTRACT[symbol];
      if(!contract||!PROVIDER_SYMBOL[symbol]) { summary.skipped++; continue; }

      const {data:account,error:accountErr}=await db.from("trading_accounts")
        .select("id,user_id,account_mode,status,currency,balance,credit_bonus,requested_leverage,archived_at,deleted_at")
        .eq("id",opt.account_id).eq("user_id",opt.user_id).maybeSingle();
      if(accountErr) throw accountErr;
      if(!account||account.account_mode!=="real"||account.status!=="approved"||account.archived_at||account.deleted_at||String(account.currency||"USD").toUpperCase()!=="USD") {
        summary.skipped++; continue;
      }
      const {data:kyc,error:kycErr}=await db.from("kyc_submissions").select("id").eq("user_id",opt.user_id).eq("status","approved").limit(1);
      if(kycErr) throw kycErr;
      if(!kyc?.length) { summary.skipped++; continue; }

      const {data:claim,error:claimErr}=await db.from("bb_ai_auto_trade_execution_log").insert({
        user_id:opt.user_id,account_id:opt.account_id,signal_id:signal.id,signal_generated_at:signal.generated_at,
        symbol,direction:side,status:"CLAIMED",requested_risk_pct:Math.min(3,Number(opt.risk_pct)||3),
        reward_pct:Math.max(2,Math.min(3,Number(opt.reward_pct)||2.5))
      }).select("id").single();
      if(claimErr?.code==="23505") { summary.skipped++; continue; }
      if(claimErr) throw claimErr;
      const logId=claim.id;
      const reject=async(reason:string,extra:any={})=>{
        await db.from("bb_ai_auto_trade_execution_log").update({status:"REJECTED",reason:reason.slice(0,1200),updated_at:new Date().toISOString(),...extra}).eq("id",logId);
        summary.rejected++;summary.results.push({account_id:opt.account_id,symbol,status:"REJECTED",reason});
      };
      try {
        const {data:quote,error:quoteErr}=await db.functions.invoke("market-data",{body:{action:"quote",symbol:PROVIDER_SYMBOL[symbol]}});
        if(quoteErr) throw new Error("Fresh market quote unavailable: "+quoteErr.message);
        const bid=Number(quote?.broker_bid),ask=Number(quote?.broker_ask),mid=Number(quote?.mid);
        const quoteAt=Date.parse(String(quote?.timestamp||""));
        const quoteAge=Date.now()-quoteAt;
        if(quote?.fallback===true||quote?.stale===true||quote?.marketState!=="open"||
          !(bid>0&&ask>=bid&&mid>0)||!Number.isFinite(quoteAge)||quoteAge<0||quoteAge>15000||
          !(Number(quote?.quoteAgeSeconds)>=0&&Number(quote?.quoteAgeSeconds)<=15)) {
          throw new Error("Fresh bid/ask validation failed (stale, fallback, closed market, or invalid spread).");
        }
        const entry=side==="BUY"?ask:bid;
        const d=signal.signal_data||{};
        const low=Number(d.entry_low),high=Number(d.entry_high),sl=Number(d.stop_loss);
        if(entry<Math.min(low,high)||entry>Math.max(low,high)) throw new Error("Current executable price is outside the AI signal entry band.");
        if((side==="BUY"&&sl>=entry)||(side==="SELL"&&sl<=entry)) throw new Error("Signal stop-loss is invalid against the executable quote.");

        const {data:openPositions,error:posErr}=await db.from("bb_bbook_positions")
          .select("quantity,contract_size,entry_price,stop_loss,margin_used,floating_pnl,status")
          .eq("account_id",opt.account_id).eq("user_id",opt.user_id).eq("status","OPEN");
        if(posErr) throw posErr;
        const open=openPositions||[];
        const floating=open.reduce((n:number,p:any)=>n+Number(p.floating_pnl||0),0);
        const usedMargin=open.reduce((n:number,p:any)=>n+Number(p.margin_used||0),0);
        const equity=Number(account.balance||0)+Number(account.credit_bonus||0)+floating;
        if(!(equity>0)) throw new Error("Account equity is not positive.");
        if(open.length>=Math.min(Number(exec.max_open_positions||5),Number(bbook.max_open_positions||5))) throw new Error("Maximum open positions reached.");
        if(open.some((p:any)=>p.stop_loss==null)) throw new Error("Existing position without stop-loss blocks AI aggregate-risk sizing.");
        const aggregateRisk=open.reduce((n:number,p:any)=>n+Math.abs(Number(p.entry_price)-Number(p.stop_loss))*Number(p.quantity)*Number(p.contract_size),0);
        const effectiveRiskPct=Math.min(3,Number(opt.risk_pct)||3,Number(exec.max_risk_per_trade_pct)||0);
        const dailyLossPct=Math.min(Number(opt.max_daily_loss_pct)||6,Number(exec.max_daily_loss_pct)||0);
        const maxAggregatePct=Number(exec.max_aggregate_risk_pct)||0;
        if(!(effectiveRiskPct>0&&dailyLossPct>0&&maxAggregatePct>0)) throw new Error("Platform risk limits are not configured.");
        const dayStart=new Date();dayStart.setUTCHours(0,0,0,0);
        const {data:closedRows,error:closedErr}=await db.from("bb_bbook_positions")
          .select("realized_pnl").eq("account_id",opt.account_id).gte("closed_at",dayStart.toISOString());
        if(closedErr) throw closedErr;
        const dailyLoss=(closedRows||[]).reduce((n:number,p:any)=>n+Math.max(0,-Number(p.realized_pnl||0)),0);
        if(dailyLoss>=equity*dailyLossPct/100) throw new Error("Account daily loss limit reached.");
        const riskBudget=equity*effectiveRiskPct/100;
        const distance=Math.abs(entry-sl);
        const rawQty=riskBudget/(distance*contract);
        const quantity=roundDown(rawQty,0.01);
        if(!(quantity>=0.01)) throw new Error("Minimum lot would exceed the permitted per-trade risk.");
        const actualRisk=distance*quantity*contract;
        if(actualRisk>riskBudget+0.01) throw new Error("Calculated lot size exceeds the effective risk budget.");
        if(aggregateRisk+actualRisk>equity*maxAggregatePct/100) throw new Error("Aggregate open-position risk limit would be exceeded.");
        const freeMargin=equity-usedMargin;
        const leverageText=String(account.requested_leverage||"");
        const parsedLeverage=Number(leverageText.split(":").at(-1));
        const marginEstimate=(entry*quantity*contract)/Math.max(1,Number.isFinite(parsedLeverage)?parsedLeverage:100);
        if(freeMargin<marginEstimate) throw new Error("Insufficient free margin for calculated AI lot size.");
        const rewardPct=Math.max(2,Math.min(3,Number(opt.reward_pct)||2.5));
        const rewardAmount=equity*rewardPct/100;
        const tpDistance=rewardAmount/(quantity*contract);
        const tp=side==="BUY"?entry+tpDistance:entry-tpDistance;
        const spreadCost=(ask-bid)*quantity*contract;
        // Re-read opt-in immediately before order submission so OFF takes effect at the final execution gate.
        const {data:latestOptIn,error:optInCheckErr}=await db.from("bb_ai_auto_trade_settings")
          .select("enabled").eq("user_id",opt.user_id).eq("account_id",opt.account_id).maybeSingle();
        if(optInCheckErr) throw optInCheckErr;
        if(latestOptIn?.enabled!==true) throw new Error("AI Auto-Trade was switched OFF before order submission.");

        const {data:opened,error:openErr}=await db.rpc("bb_bbook_open_position",{p:{
          user_id:opt.user_id,account_id:opt.account_id,symbol,side,quantity,contract_size:contract,
          mid,bid,ask,stop_loss:sl,take_profit:tp,spread_cost:spreadCost
        }});
        if(openErr) throw new Error("B-Book rejected order: "+openErr.message);
        const positionId=opened?.position?.id||null;
        await db.from("bb_ai_auto_trade_execution_log").update({
          status:"OPENED",position_id:positionId,reason:"Opened through internal B-Book after fresh quote and risk validation.",
          quote_bid:bid,quote_ask:ask,quote_time:new Date(quote.timestamp).toISOString(),equity,
          effective_risk_pct:effectiveRiskPct,risk_amount:actualRisk,quantity,contract_size:contract,updated_at:new Date().toISOString()
        }).eq("id",logId);
        summary.opened++;summary.results.push({account_id:opt.account_id,symbol,status:"OPENED",position_id:positionId,quantity,risk_pct:effectiveRiskPct});
      } catch(error) {
        await reject(error instanceof Error?error.message:"Unknown AI execution rejection");
      }
    }
    return json({ok:true,...summary,generated_at:new Date().toISOString()});
  } catch(error) {
    console.error("ai-bbook-executor:",error);
    return json({error:error instanceof Error?error.message:"AI executor failed"},500);
  }
});