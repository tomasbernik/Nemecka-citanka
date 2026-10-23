import webpush from "npm:web-push@3.6.7";
import { createECDH, createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const publisherEmail = "tomas.bernik@gmail.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function normalize(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function deriveVapidKeys(seed: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const privateKey = createHash("sha256")
      .update(`nemecka-citanka-web-push-v1:${seed}:${attempt}`)
      .digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privateKey);
      return {
        publicKey: ecdh.getPublicKey().toString("base64url"),
        privateKey: privateKey.toString("base64url")
      };
    } catch {
      // A SHA-256 result can very rarely fall outside the P-256 scalar range.
    }
  }
  throw new Error("vapid_key_derivation_failed");
}

async function restRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, { ...options, headers });
}

async function readRows(response: Response) {
  if (!response.ok) throw new Error(`database_${response.status}`);
  return response.json();
}

async function getAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization }
  });
  if (!response.ok) return null;
  return response.json();
}

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function deliverPushes(
  supabaseUrl: string,
  serviceRoleKey: string,
  subscriptions: StoredSubscription[],
  notification: string
) {
  let sent = 0;
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, notification, { TTL: 86400, urgency: "high" });
      sent += 1;
    } catch (error) {
      const pushError = error as { statusCode?: number; message?: string };
      const statusCode = Number(pushError.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await restRequest(supabaseUrl, serviceRoleKey,
          `app_push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`,
          { method: "DELETE" });
      } else {
        console.error("Push delivery failed", statusCode, String(pushError.message || error).slice(0, 300));
      }
    }
  }));
  return sent;
}

const messages: Record<string, { title: string; body: (title: string) => string }> = {
  sk: { title: "Nové čítanie", body: title => `Učiteľ ti pridelil text „${title}“.` },
  de: { title: "Neue Leseaufgabe", body: title => `Deine Lehrkraft hat dir „${title}“ zugewiesen.` },
  en: { title: "New reading assignment", body: title => `Your teacher assigned “${title}” to you.` },
  ru: { title: "Новое задание для чтения", body: title => `Учитель назначил тебе текст «${title}».` },
  pl: { title: "Nowe zadanie do czytania", body: title => `Nauczyciel przydzielił Ci tekst „${title}”.` },
  hu: { title: "Új olvasási feladat", body: title => `A tanárod kijelölte neked ezt: „${title}”.` },
  ro: { title: "Lectură nouă", body: title => `Profesorul ți-a atribuit textul „${title}”.` },
  it: { title: "Nuova lettura", body: title => `L'insegnante ti ha assegnato “${title}”.` },
  fr: { title: "Nouvelle lecture", body: title => `Ton professeur t’a attribué « ${title} ».` },
  tr: { title: "Yeni okuma görevi", body: title => `Öğretmenin sana “${title}” metnini atadı.` }
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const configuredPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const configuredPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:tomas.bernik@gmail.com";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "missing_supabase_environment" }, 500);
  }
  const derivedKeys = configuredPublicKey && configuredPrivateKey
    ? null
    : deriveVapidKeys(serviceRoleKey);
  const vapidPublicKey = configuredPublicKey || derivedKeys?.publicKey || "";
  const vapidPrivateKey = configuredPrivateKey || derivedKeys?.privateKey || "";

  const user = await getAuthenticatedUser(req, supabaseUrl, anonKey);
  if (!user?.id) return jsonResponse({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const action = normalize(payload.action, 40);

  if (action === "config") {
    if (!vapidPublicKey) return jsonResponse({ error: "push_not_configured" }, 503);
    return jsonResponse({ publicKey: vapidPublicKey });
  }

  if (action === "subscribe") {
    const profileId = normalize(payload.profileId, 120);
    const deviceId = normalize(payload.deviceId, 200);
    const subscription = payload.subscription as Record<string, unknown> | undefined;
    const endpoint = normalize(subscription?.endpoint, 2000);
    const keys = subscription?.keys as Record<string, unknown> | undefined;
    const p256dh = normalize(keys?.p256dh, 500);
    const auth = normalize(keys?.auth, 500);
    if (!profileId || !endpoint.startsWith("https://") || !p256dh || !auth) {
      return jsonResponse({ error: "invalid_subscription" }, 400);
    }

    const profiles = await readRows(await restRequest(
      supabaseUrl,
      serviceRoleKey,
      `app_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,role,auth_user_id,owner_auth_user_id&limit=1`
    ));
    const profile = profiles[0];
    const isAdmin = String(user.email || "").toLowerCase() === publisherEmail;
    if (!profile
      || (profile.auth_user_id !== user.id && profile.owner_auth_user_id !== user.id)
      || (profile.role !== "student" && !isAdmin)) {
      return jsonResponse({ error: "profile_forbidden" }, 403);
    }

    const response = await restRequest(
      supabaseUrl,
      serviceRoleKey,
      "app_push_subscriptions?on_conflict=endpoint",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          profile_id: profileId,
          auth_user_id: user.id,
          endpoint,
          p256dh,
          auth,
          device_id: deviceId || null,
          user_agent: req.headers.get("user-agent") || "",
          is_admin: isAdmin,
          last_seen_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) return jsonResponse({ error: "subscription_save_failed" }, 502);
    return jsonResponse({ subscribed: true });
  }

  if (!vapidPublicKey || !vapidPrivateKey) return jsonResponse({ error: "push_not_configured" }, 503);
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  if (action === "notify-teacher-request") {
    const profileId = normalize(payload.profileId, 120);
    if (!profileId) return jsonResponse({ error: "invalid_request" }, 400);

    const [profiles, requests] = await Promise.all([
      readRows(await restRequest(supabaseUrl, serviceRoleKey,
        `app_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,name,auth_user_id,owner_auth_user_id&limit=1`)),
      readRows(await restRequest(supabaseUrl, serviceRoleKey,
        `app_teacher_requests?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.pending&select=profile_id,email,status,requested_at,push_notified_at&limit=1`))
    ]);
    const profile = profiles[0];
    const teacherRequest = requests[0];
    if (!profile || !teacherRequest
      || (profile.auth_user_id !== user.id && profile.owner_auth_user_id !== user.id)) {
      return jsonResponse({ error: "teacher_request_forbidden" }, 403);
    }

    const requestedAt = normalize(teacherRequest.requested_at, 80);
    if (teacherRequest.push_notified_at
      && new Date(teacherRequest.push_notified_at).getTime() >= new Date(requestedAt).getTime()) {
      return jsonResponse({ sent: 0, alreadyNotified: true });
    }
    const claimResponse = await restRequest(
      supabaseUrl,
      serviceRoleKey,
      `app_teacher_requests?profile_id=eq.${encodeURIComponent(profileId)}&status=eq.pending&or=(push_notified_at.is.null,push_notified_at.lt.${encodeURIComponent(requestedAt)})`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ push_notified_at: new Date().toISOString() })
      }
    );
    const claimedRequests = await readRows(claimResponse);
    if (!claimedRequests.length) return jsonResponse({ sent: 0, alreadyNotified: true });

    const subscriptions = await readRows(await restRequest(supabaseUrl, serviceRoleKey,
      "app_push_subscriptions?is_admin=eq.true&select=id,endpoint,p256dh,auth")) as StoredSubscription[];
    const applicant = normalize(profile.name || teacherRequest.email, 120);
    const notification = JSON.stringify({
      title: "Nová žiadosť o učiteľský účet",
      body: `${applicant} čaká na schválenie licencie.`,
      url: "./index.html?adminPanel=teacherRequests",
      tag: `teacher-request-${profileId}`
    });
    const sent = await deliverPushes(supabaseUrl, serviceRoleKey, subscriptions, notification);
    return jsonResponse({ sent, subscribedDevices: subscriptions.length });
  }

  if (action !== "notify-assignment") return jsonResponse({ error: "invalid_action" }, 400);

  const profileId = normalize(payload.profileId, 120);
  const articleId = normalize(payload.articleId, 200);
  const teamId = normalize(payload.teamId, 120);
  if (!profileId || !articleId || !teamId) return jsonResponse({ error: "invalid_request" }, 400);

  const [teams, memberships, profiles, articles, profileData] = await Promise.all([
    readRows(await restRequest(supabaseUrl, serviceRoleKey,
      `app_teams?id=eq.${encodeURIComponent(teamId)}&select=id,owner_profile_id&limit=1`)),
    readRows(await restRequest(supabaseUrl, serviceRoleKey,
      `app_team_memberships?team_id=eq.${encodeURIComponent(teamId)}&profile_id=eq.${encodeURIComponent(profileId)}&select=team_id&limit=1`)),
    readRows(await restRequest(supabaseUrl, serviceRoleKey,
      `app_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,role,auth_user_id,owner_auth_user_id,native_language&limit=1`)),
    readRows(await restRequest(supabaseUrl, serviceRoleKey,
      `app_articles?id=eq.${encodeURIComponent(articleId)}&select=id,title,series_title&limit=1`)),
    readRows(await restRequest(supabaseUrl, serviceRoleKey,
      `app_profile_data?profile_id=eq.${encodeURIComponent(profileId)}&select=data&limit=1`))
  ]);

  const team = teams[0];
  const student = profiles[0];
  const article = articles[0];
  if (!team || !memberships[0] || !student || student.role !== "student" || !article) {
    return jsonResponse({ error: "assignment_target_forbidden" }, 403);
  }

  const owners = await readRows(await restRequest(supabaseUrl, serviceRoleKey,
    `app_profiles?id=eq.${encodeURIComponent(team.owner_profile_id)}&select=auth_user_id,owner_auth_user_id&limit=1`));
  const owner = owners[0];
  const isTeamOwner = owner && (owner.auth_user_id === user.id || owner.owner_auth_user_id === user.id);
  if (!isTeamOwner && String(user.email || "").toLowerCase() !== publisherEmail) {
    return jsonResponse({ error: "teacher_forbidden" }, 403);
  }

  const assignments = profileData[0]?.data?.assignments;
  if (!Array.isArray(assignments) || !assignments.some(item => item?.articleId === articleId)) {
    return jsonResponse({ error: "assignment_not_found" }, 409);
  }

  const subscriptions = await readRows(await restRequest(supabaseUrl, serviceRoleKey,
    `app_push_subscriptions?profile_id=eq.${encodeURIComponent(profileId)}&select=id,endpoint,p256dh,auth`));
  if (!subscriptions.length) return jsonResponse({ sent: 0, subscribedDevices: 0 });

  const language = messages[student.native_language] ? student.native_language : "de";
  const copy = messages[language];
  const readingTitle = normalize(article.series_title || article.title, 180);
  const notification = JSON.stringify({
    title: copy.title,
    body: copy.body(readingTitle),
    url: `./index.html?assignedArticle=${encodeURIComponent(articleId)}`,
    tag: `assignment-${profileId}-${articleId}`
  });

  const sent = await deliverPushes(
    supabaseUrl,
    serviceRoleKey,
    subscriptions as StoredSubscription[],
    notification
  );

  return jsonResponse({ sent, subscribedDevices: subscriptions.length });
});
