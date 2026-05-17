const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function firstHeader(req: Request, names: string[]) {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing Supabase function environment", { status: 500, headers: corsHeaders });
  }

  const event = await req.json();
  const ip = firstHeader(req, ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"])?.split(",")[0]?.trim() || "";
  const country = firstHeader(req, ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"]);
  const city = firstHeader(req, ["x-vercel-ip-city", "x-client-geo-city", "cf-ipcity"]);
  const salt = Deno.env.get("IP_HASH_SALT") || serviceRoleKey.slice(0, 24);

  const body = {
    ...event,
    event_type: "app_opened",
    country: country || null,
    city: city || null,
    ip_hash: ip ? await sha256(`${salt}:${ip}`) : null,
    user_agent: event.user_agent || req.headers.get("user-agent") || null
  };

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/app_events`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, country, city: city || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
