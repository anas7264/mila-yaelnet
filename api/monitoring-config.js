"use strict";

function parsePublicDsn(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 512) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname || !url.username) return null;
    if (url.password || url.search || url.hash) return null;
    if (!/^\/[A-Za-z0-9._~/%-]{1,180}\/?$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function monitoringConfig(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ enabled: false, error: "method_not_allowed" });
  }

  const dsn = parsePublicDsn(process.env.GLITCHTIP_DSN);
  const environment = ["production", "preview", "development"].includes(process.env.VERCEL_ENV)
    ? process.env.VERCEL_ENV
    : "production";
  const release = /^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || "")
    ? process.env.VERCEL_GIT_COMMIT_SHA
    : undefined;

  return res.status(200).json({
    enabled: Boolean(dsn),
    ...(dsn ? { dsn } : {}),
    environment,
    ...(release ? { release } : {})
  });
}

module.exports = monitoringConfig;
module.exports.parsePublicDsn = parsePublicDsn;
