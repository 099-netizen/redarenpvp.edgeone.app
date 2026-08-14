/* ============================================================
   RED ARENA — Leaderboard API  (EdgeOne Pages Function)

   File  : /functions/api/leaderboard.js
   Route : https://redarenpvp.edgeone.app/api/leaderboard

   Site එකම EdgeOne එකේ නිසා same-origin — CORS ප්‍රශ්නයක් නෑ.
   ============================================================ */

// ---- RANKS: ඉහළම rank එක උඩම ----
const RANKS = [
  // ---------- TOP ----------
  { roleId: "1510714691155132436", name: "GRAND MASTER", group: "Grand Master", color: "#ff2d3f", icon: "fa-crown" },
  { roleId: "1510714692736389351", name: "MASTER",       group: "Master",       color: "#b14aff", icon: "fa-chess-king" },

  // ---------- DIAMOND ----------
  { roleId: "1510714694162448414", name: "DIAMOND III",  group: "Diamond",  color: "#7ceaff", icon: "fa-gem" },
  { roleId: "1510714695894564957", name: "DIAMOND II",   group: "Diamond",  color: "#4ad9f5", icon: "fa-gem" },
  { roleId: "1510714697907831038", name: "DIAMOND I",    group: "Diamond",  color: "#22c3e6", icon: "fa-gem" },

  // ---------- PLATINUM ----------
  { roleId: "1510714699317252108", name: "PLATINUM III", group: "Platinum", color: "#6ff0c0", icon: "fa-shield-halved" },
  { roleId: "1510714701917720677", name: "PLATINUM II",  group: "Platinum", color: "#3ddc97", icon: "fa-shield-halved" },
  { roleId: "1510714703314423828", name: "PLATINUM I",   group: "Platinum", color: "#22bd7d", icon: "fa-shield-halved" },

  // ---------- GOLD ----------
  { roleId: "1510714704836956220", name: "GOLD III",     group: "Gold",     color: "#ffd968", icon: "fa-medal" },
  { roleId: "1510714706460147766", name: "GOLD II",      group: "Gold",     color: "#ffc93c", icon: "fa-medal" },
  { roleId: "1510714708179816538", name: "GOLD I",       group: "Gold",     color: "#e0a91b", icon: "fa-medal" },

  // ---------- SILVER ----------
  { roleId: "1510714709479784652", name: "SILVER III",   group: "Silver",   color: "#dfe6f0", icon: "fa-award" },
  { roleId: "1510714711535124590", name: "SILVER II",    group: "Silver",   color: "#c3cede", icon: "fa-award" },
  { roleId: "1510714712831164526", name: "SILVER I",     group: "Silver",   color: "#a5b1c4", icon: "fa-award" },

  // ---------- BRONZE ----------
  { roleId: "1510714714429198336", name: "BRONZE III",   group: "Bronze",   color: "#e09b5a", icon: "fa-shield" },
  { roleId: "1510714716442595578", name: "BRONZE II",    group: "Bronze",   color: "#cd7f32", icon: "fa-shield" },
  { roleId: "1510714718531092722", name: "BRONZE I",     group: "Bronze",   color: "#a86527", icon: "fa-shield" },
];

const SHOW_UNRANKED = false;
const CACHE_SECONDS = 300;
const MAX_PAGES     = 10;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

function avatarUrl(user, member, guildId) {
  if (member.avatar) {
    const ext = member.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.${ext}?size=128`;
  }
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  const disc = Number(user.discriminator);
  const idx = disc && disc > 0 ? disc % 5 : Number(user.id.slice(-2)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

async function fetchMembers(guildId, token) {
  const all = [];
  let after = "0";

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    if (res.status === 429) {
      const r = await res.json().catch(() => ({}));
      throw new Error(`Rate limited by Discord. Retry after ${r.retry_after || "?"}s`);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Discord API ${res.status}: ${txt.slice(0, 200)}`);
    }

    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }
  return all;
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestGet({ env }) {
  try {
    const token = env.DISCORD_TOKEN;
    const guildId = env.GUILD_ID;

    if (!token || !guildId) {
      return jsonResponse(
        { ok: false, error: "DISCORD_TOKEN / GUILD_ID environment variables missing" },
        500
      );
    }

    const members = await fetchMembers(guildId, token);
    const rows = [];

    for (const m of members) {
      if (!m.user || m.user.bot) continue;

      let idx = -1;
      for (let i = 0; i < RANKS.length; i++) {
        if (m.roles && m.roles.indexOf(RANKS[i].roleId) !== -1) { idx = i; break; }
      }
      if (idx === -1 && !SHOW_UNRANKED) continue;

      const rank = idx === -1
        ? { name: "UNRANKED", group: "Unranked", color: "#5b606b", icon: "fa-user" }
        : RANKS[idx];

      rows.push({
        id: m.user.id,
        name: m.nick || m.user.global_name || m.user.username,
        tag: m.user.username,
        avatar: avatarUrl(m.user, m, guildId),
        rank: rank.name,
        group: rank.group,
        color: rank.color,
        icon: rank.icon,
        tier: idx === -1 ? RANKS.length : idx,
        joined: m.joined_at ? Date.parse(m.joined_at) : 0,
      });
    }

    rows.sort((a, b) => a.tier - b.tier || a.joined - b.joined);
    rows.forEach((r, i) => { r.position = i + 1; });

    return jsonResponse({
      ok: true,
      updated: new Date().toISOString(),
      count: rows.length,
      players: rows,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}
