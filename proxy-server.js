import http from "node:http";
import https from "node:https";
import { Innertube, Platform } from "youtubei.js";
import { Jinter } from "jintr";

Platform.shim.eval = (code) => { const s = typeof code === "string" ? code : code?.output || String(code); return new Function(s)(); };

const PORT = 3001;

// ===== YOUTUBE =====
async function createYT() { return await Innertube.create({ generate_session_locally: true, enable_safety_mode: false }); }

const ytCache = new Map();
async function ytGetStreamUrl(videoId) {
  const cached = ytCache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached;
  const yt = await createYT();
  const info = await yt.getBasicInfo(videoId);
  const sd = info.streaming_data;
  if (!sd) return null;
  const all = (sd.formats || []).filter(f => f.has_video && f.has_audio);
  const mp4 = all.filter(f => f.mime_type?.includes("video/mp4")).sort((a, b) => {
    const aH = a.height || 0, bH = b.height || 0;
    if (aH <= 720 && bH <= 720) return bH - aH;
    if (aH <= 720) return -1; if (bH <= 720) return 1; return aH - bH;
  });
  const format = mp4[0] || all[0];
  if (!format) return null;
  const url = await format.decipher(yt.session.player);
  if (!url) return null;
  const result = { url, quality: format.quality_label || "360p", width: format.width || 640, height: format.height || 360, expires: Date.now() + 10 * 60 * 1000 };
  ytCache.set(videoId, result);
  return result;
}

async function ytSearch(query) {
  const yt = await createYT();
  const results = await yt.search(query, { type: "video" });
  return (results.results || []).filter(i => i.type === "Video").slice(0, 20).map(i => ({
    id: i.id || "", title: i.title?.text || i.title?.toString() || "",
    thumbnail: i.thumbnails?.[0]?.url || "", author: i.author?.name || "",
    duration: i.duration?.text || "", views: i.short_view_count?.text || "",
  }));
}

// ===== EINTHUSAN =====
const einCache = new Map();
let einCookies = "";

function httpGet(url, cookies) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
    if (cookies) headers["Cookie"] = cookies;
    https.get({ hostname: opts.hostname, path: opts.pathname + opts.search, headers }, (res) => {
      // Collect set-cookie
      const setCookies = res.headers["set-cookie"] || [];
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => resolve({ data, status: res.statusCode, setCookies }));
    }).on("error", reject);
  });
}

function httpPost(url, body, cookies) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const postData = typeof body === "string" ? body : new URLSearchParams(body).toString();
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
      "Origin": `https://${opts.hostname}`,
      "Referer": url,
    };
    if (cookies) headers["Cookie"] = cookies;
    const req = https.request({ hostname: opts.hostname, path: opts.pathname + opts.search, method: "POST", headers }, (res) => {
      const setCookies = res.headers["set-cookie"] || [];
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => resolve({ data, status: res.statusCode, setCookies }));
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function einDecrypt(encrypted) {
  const rearranged = encrypted.slice(0, 10) + encrypted.slice(-1) + encrypted.slice(12, -1);
  return JSON.parse(Buffer.from(rearranged, "base64").toString("utf-8"));
}

async function einLogin(email, password) {
  try {
    // Get login page for CSRF token
    const page = await httpGet("https://einthusan.tv/login/");
    const pageIdMatch = page.data.match(/data-pageid="([^"]+)"/);
    const pageId = pageIdMatch ? pageIdMatch[1] : "";

    // Collect initial cookies
    const initCookies = page.setCookies.map(c => c.split(";")[0]).join("; ");

    // POST login
    const loginRes = await httpPost("https://einthusan.tv/login/", {
      "xEvent": "Login.PingOutcome",
      "xJson": JSON.stringify({ Email: email, Password: password }),
      "arcVersion": "3",
      "appVersion": "59",
      "gorilla.csrf.Token": pageId,
    }, initCookies);

    // Collect all cookies
    const allCookies = [...page.setCookies, ...loginRes.setCookies].map(c => c.split(";")[0]).join("; ");
    einCookies = allCookies;

    // Check if login worked
    const isLoggedIn = !loginRes.data.includes("incorrect") && loginRes.status < 400;
    return { success: isLoggedIn, cookies: allCookies };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function einGetStreamUrl(movieId) {
  const cached = einCache.get(movieId);
  if (cached && cached.expires > Date.now()) return cached;

  try {
    const pageUrl = `https://einthusan.tv/movie/watch/${movieId}/`;
    const page = await httpGet(pageUrl, einCookies);

    const pageIdMatch = page.data.match(/data-pageid="([^"]+)"/);
    const pageId = pageIdMatch ? pageIdMatch[1] : "";

    const ejMatch = page.data.match(/data-ejpingables="([^"]+)"/);
    const ejPingables = ejMatch ? ejMatch[1] : "";

    const titleMatch = page.data.match(/<h3>([^<]+)<\/h3>/);
    const title = titleMatch ? titleMatch[1] : "Movie";

    const thumbMatch = page.data.match(/moviecovers\/([^"']+)/);
    const thumbnail = thumbMatch ? `https://einthusan.tv/moviecovers/${thumbMatch[1]}` : "";

    if (!ejPingables) return { error: "Could not find video data — login may be required" };

    // Collect page cookies
    const pageCookies = [...(page.setCookies || [])].map(c => c.split(";")[0]).join("; ");
    const cookies = einCookies ? einCookies + "; " + pageCookies : pageCookies;

    const ajaxRes = await httpPost(`https://einthusan.tv/ajax/movie/watch/${movieId}/`, {
      "xEvent": "UIVideoPlayer.PingOutcome",
      "xJson": JSON.stringify({ EJOutcomes: ejPingables, NativeHLS: false }),
      "arcVersion": "3",
      "appVersion": "59",
      "gorilla.csrf.Token": pageId,
    }, cookies);

    const jsonData = JSON.parse(ajaxRes.data);
    const videoData = jsonData.Data;

    if (typeof videoData === "string" && videoData.startsWith("/ratelimited/")) {
      return { error: "Rate limited — try again later" };
    }

    const ejLinks = einDecrypt(videoData.EJLinks);
    const mp4Url = ejLinks.MP4Link;
    const hlsUrl = ejLinks.HLSLink;

    const streamUrl = mp4Url || hlsUrl;
    if (!streamUrl) return { error: "No video URL found" };

    const result = { url: streamUrl, title, thumbnail, quality: "HD", expires: Date.now() + 30 * 60 * 1000 };
    einCache.set(movieId, result);
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function einSearch(query, lang) {
  try {
    const language = lang || "tamil";
    const searchUrl = `https://einthusan.tv/movie/results/?lang=${language}&query=${encodeURIComponent(query)}`;
    const page = await httpGet(searchUrl, einCookies);

    const movies = [];
    const blocks = page.data.split('<div class="block1"');

    for (let i = 1; i < blocks.length && movies.length < 20; i++) {
      const block = blocks[i];
      const idMatch = block.match(/\/movie\/watch\/([^/"]+)/);
      const titleMatch = block.match(/<h3>([^<]+)<\/h3>/);
      const imgMatch = block.match(/src="([^"]*moviecovers[^"]*)"/);
      const yearMatch = block.match(/<div class="info">\s*(\d{4})/);

      if (idMatch && titleMatch) {
        movies.push({
          id: idMatch[1],
          title: titleMatch[1].trim(),
          thumbnail: imgMatch ? (imgMatch[1].startsWith("//") ? "https:" + imgMatch[1] : imgMatch[1]) : "",
          year: yearMatch ? yearMatch[1] : "",
        });
      }
    }

    return movies;
  } catch (e) {
    return [];
  }
}

// ===== PROXY VIDEO =====
async function proxyVideo(url, req, res) {
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0" };
  if (req.headers.range) headers["Range"] = req.headers.range;
  if (einCookies) headers["Cookie"] = einCookies;

  try {
    const ytRes = await fetch(url, { headers });
    cors(res);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=600");
    const cl = ytRes.headers.get("content-length"); if (cl) res.setHeader("Content-Length", cl);
    const cr = ytRes.headers.get("content-range"); if (cr) res.setHeader("Content-Range", cr);
    res.writeHead(ytRes.status);
    const reader = ytRes.body.getReader();
    (async () => { while (true) { const { done, value } = await reader.read(); if (done) { res.end(); return; } if (!res.write(value)) await new Promise(r => res.once("drain", r)); } })().catch(() => res.end());
  } catch (e) { if (!res.headersSent) sendJSON(res, { error: "Proxy failed" }, 500); }
}

// ===== HTTP SERVER =====
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
}

function sendJSON(res, data, status) {
  cors(res); res.setHeader("Content-Type", "application/json");
  res.writeHead(status || 200); res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);
  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); res.end(); return; }

  // YouTube
  if (url.pathname === "/stream") {
    const v = url.searchParams.get("v");
    if (!v) return sendJSON(res, { error: "Missing ID" }, 400);
    const info = await ytGetStreamUrl(v);
    if (!info) return sendJSON(res, { fallback: true, embedUrl: "https://www.youtube-nocookie.com/embed/" + v + "?autoplay=1&playsinline=1&rel=0" });
    return sendJSON(res, { url: "/video?v=" + v, audioUrl: "/video?v=" + v, quality: info.quality, width: info.width, height: info.height, mimeType: "video/mp4" });
  }
  if (url.pathname === "/video") {
    const v = url.searchParams.get("v");
    if (!v) return sendJSON(res, { error: "Missing ID" }, 400);
    const info = await ytGetStreamUrl(v);
    if (!info) return sendJSON(res, { error: "No stream" }, 404);
    return proxyVideo(info.url, req, res);
  }
  if (url.pathname === "/search") {
    const q = url.searchParams.get("q");
    if (!q) return sendJSON(res, { error: "Missing query" }, 400);
    try { const videos = await ytSearch(q); sendJSON(res, { videos }); } catch { sendJSON(res, { videos: [] }); }
    return;
  }

  // Einthusan
  if (url.pathname === "/ein/login" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = await einLogin(body.email, body.password);
    return sendJSON(res, result);
  }
  if (url.pathname === "/ein/search") {
    const q = url.searchParams.get("q");
    const lang = url.searchParams.get("lang") || "tamil";
    if (!q) return sendJSON(res, { error: "Missing query" }, 400);
    const movies = await einSearch(q, lang);
    return sendJSON(res, { movies });
  }
  if (url.pathname === "/ein/stream") {
    const id = url.searchParams.get("id");
    if (!id) return sendJSON(res, { error: "Missing movie ID" }, 400);
    const info = await einGetStreamUrl(id);
    if (info.error) return sendJSON(res, info, 400);
    return sendJSON(res, { url: "/ein/video?id=" + id, title: info.title, thumbnail: info.thumbnail, quality: info.quality, mimeType: "video/mp4" });
  }
  if (url.pathname === "/ein/video") {
    const id = url.searchParams.get("id");
    if (!id) return sendJSON(res, { error: "Missing ID" }, 400);
    const info = await einGetStreamUrl(id);
    if (info.error || !info.url) return sendJSON(res, { error: info.error || "No stream" }, 404);
    return proxyVideo(info.url, req, res);
  }
  if (url.pathname === "/ein/status") {
    return sendJSON(res, { loggedIn: !!einCookies });
  }

  cors(res); res.writeHead(200); res.end("YaVik Proxy");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("YaVik Proxy on port " + PORT);
  console.log("  YouTube: /search, /stream, /video");
  console.log("  Einthusan: /ein/login, /ein/search, /ein/stream, /ein/video");
});
