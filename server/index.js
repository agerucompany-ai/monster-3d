// ============================================================
// モンスター戦略3D オンライン対戦サーバー
// 汎用2人ルーム中継（relay）。ゲームのルールは一切持たない。
//   - ホスト(host)が部屋を作り、権威的な対局状態を自分のブラウザで持つ。
//   - ゲスト(guest)が6桁コードで参加。
//   - サーバーは create/join/resume だけを処理し、それ以外のメッセージは
//     「もう一方のプレイヤーへそのまま転送」するだけ（state同期・着手はクライアント間でやりとり）。
//   - 地形将棋サーバー(terrain-shogi)の構成（ws・部屋・再接続トークン・heartbeat・/health）を流用。
// ============================================================
import http from "http";
import crypto from "crypto";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6時間アクセスのない部屋は破棄（権威状態はクライアント側なので短め）

// ============================================================
// クラウドセーブ（ID+PIN引き継ぎ）
//   POST /api/cloud/new            → {id, pin} 発行
//   PUT  /api/cloud/:id {pin,data} → 保存
//   GET  /api/cloud/:id?pin=XXXX   → {data}
// 永続化: GitHubプライベートリポジトリ (env: GH_SAVES_TOKEN / GH_SAVES_REPO)
// メモリはキャッシュ。トークン未設定時はメモリのみ（再起動で消える）。
// ============================================================
const SAVES_REPO = process.env.GH_SAVES_REPO || "";
const SAVES_TOKEN = process.env.GH_SAVES_TOKEN || "";
const saves = new Map(); // id -> {pinHash, data, sha}
const ID_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字(0O1I)抜き
const MAX_SAVE_BYTES = 300 * 1024;

function genSaveId() {
  let s = "";
  for (let i = 0; i < 8; i++) { s += ID_CH[crypto.randomInt(ID_CH.length)]; }
  return s.slice(0, 4) + "-" + s.slice(4);
}
function genPin() { return String(crypto.randomInt(1000, 10000)); }
function pinHash(id, pin) { return crypto.createHash("sha256").update(id + ":" + String(pin)).digest("hex"); }
function normId(raw) { return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2"); }

const GH_API = "https://api.github.com";
const ghHeaders = { Authorization: `Bearer ${SAVES_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "monster3d-saves" };
async function ghLoad(id) {
  if (!SAVES_TOKEN || !SAVES_REPO) return null;
  const r = await fetch(`${GH_API}/repos/${SAVES_REPO}/contents/saves/${id}.json`, { headers: ghHeaders });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("gh get " + r.status);
  const d = await r.json();
  return { rec: JSON.parse(Buffer.from(d.content, "base64").toString("utf8")), sha: d.sha };
}
async function ghStore(id, rec, sha) {
  if (!SAVES_TOKEN || !SAVES_REPO) return null;
  const body = { message: `save ${id}`, content: Buffer.from(JSON.stringify(rec)).toString("base64") };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_API}/repos/${SAVES_REPO}/contents/saves/${id}.json`, { method: "PUT", headers: { ...ghHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("gh put " + r.status);
  const d = await r.json();
  return d.content && d.content.sha;
}
async function loadRec(id) {
  if (saves.has(id)) return saves.get(id);
  const g = await ghLoad(id).catch(() => null);
  if (!g) return null;
  const rec = { pinHash: g.rec.pinHash, data: g.rec.data, sha: g.sha };
  saves.set(id, rec);
  return rec;
}

// 簡易レート制限（PIN総当たり対策）: IPごと 30リクエスト/分
const rateMap = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const e = rateMap.get(ip) || { n: 0, t: now };
  if (now - e.t > 60000) { e.n = 0; e.t = now; }
  e.n++; rateMap.set(ip, e);
  if (rateMap.size > 5000) rateMap.clear();
  return e.n > 30;
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let len = 0; const chunks = [];
    req.on("data", (c) => { len += c.length; if (len > MAX_SAVE_BYTES) { reject(new Error("too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}

async function handleCloud(req, res, url) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
  if (rateLimited(ip)) return sendJson(res, 429, { error: "しばらく待ってから再試行してください" });

  // 新規ID発行
  if (req.method === "POST" && url.pathname === "/api/cloud/new") {
    let id = genSaveId();
    for (let i = 0; i < 5 && (saves.has(id) || (await ghLoad(id).catch(() => null))); i++) id = genSaveId();
    const pin = genPin();
    const rec = { pinHash: pinHash(id, pin), data: null, sha: null };
    saves.set(id, rec);
    try { rec.sha = await ghStore(id, { pinHash: rec.pinHash, data: null }, null); } catch (e) { console.log("gh new fail", e.message); }
    return sendJson(res, 200, { id, pin, durable: !!rec.sha });
  }

  const m = url.pathname.match(/^\/api\/cloud\/([A-Za-z0-9-]{6,12})$/);
  if (!m) return sendJson(res, 404, { error: "not found" });
  const id = normId(m[1]);

  // 保存
  if (req.method === "PUT") {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const rec = await loadRec(id);
    if (!rec) return sendJson(res, 404, { error: "IDが見つかりません" });
    if (pinHash(id, body.pin) !== rec.pinHash) return sendJson(res, 403, { error: "PINが違います" });
    if (!body.data || typeof body.data !== "object") return sendJson(res, 400, { error: "dataがありません" });
    rec.data = body.data;
    let durable = false;
    try { rec.sha = await ghStore(id, { pinHash: rec.pinHash, data: rec.data }, rec.sha); durable = !!rec.sha; }
    catch (e) {
      // sha競合等は一度リロードして再試行
      try { const g = await ghLoad(id); rec.sha = await ghStore(id, { pinHash: rec.pinHash, data: rec.data }, g && g.sha); durable = !!rec.sha; }
      catch (e2) { console.log("gh put fail", id, e2.message); }
    }
    return sendJson(res, 200, { ok: true, durable });
  }

  // 取得（ログイン）
  if (req.method === "GET") {
    const rec = await loadRec(id);
    if (!rec) return sendJson(res, 404, { error: "IDが見つかりません" });
    if (pinHash(id, url.searchParams.get("pin")) !== rec.pinHash) return sendJson(res, 403, { error: "PINが違います" });
    if (!rec.data) return sendJson(res, 404, { error: "まだデータが保存されていません" });
    return sendJson(res, 200, { data: rec.data });
  }

  return sendJson(res, 405, { error: "method" });
}

// ---- HTTP（ヘルスチェック + クラウドセーブAPI） ----
// ============================================================
// ジェムショップ: 購入コード方式(Stripe Payment Links対応)
//   POST /api/shop/gen    {adminKey, gems, count}          → コードをcount枚発行(管理用)
//   POST /api/shop/redeem {code, id?, pin?}                → コードを引き換え→gems付与(単回)
// コードは saves/codes.json (GitHubプライベートrepo) に永続化。メモリはキャッシュ。
// ADMIN_KEY 未設定なら発行APIは無効(引き換えは可)。
// ============================================================
const ADMIN_KEY = process.env.ADMIN_KEY || "";
let codesCache = null;  // {code: {gems, used, usedAt}}
async function ghLoadCodes() {
  if (!SAVES_TOKEN || !SAVES_REPO) return {};
  const r = await fetch(`${GH_API}/repos/${SAVES_REPO}/contents/shop/codes.json`, { headers: ghHeaders });
  if (r.status === 404) return { __sha: null, codes: {} };
  if (!r.ok) throw new Error("gh codes get " + r.status);
  const d = await r.json();
  return { __sha: d.sha, codes: JSON.parse(Buffer.from(d.content, "base64").toString("utf8")) };
}
async function ghStoreCodes(codes, sha) {
  if (!SAVES_TOKEN || !SAVES_REPO) return null;
  const body = { message: "shop codes", content: Buffer.from(JSON.stringify(codes)).toString("base64") };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_API}/repos/${SAVES_REPO}/contents/shop/codes.json`, { method: "PUT", headers: { ...ghHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("gh codes put " + r.status);
  const d = await r.json();
  return d.content && d.content.sha;
}
async function loadCodes() {
  if (codesCache) return codesCache;
  const g = await ghLoadCodes().catch(() => ({ __sha: null, codes: {} }));
  codesCache = { sha: g.__sha, codes: g.codes || {} };
  return codesCache;
}
const CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genShopCode() {
  let s = "";
  for (let i = 0; i < 12; i++) s += CODE_CH[crypto.randomInt(CODE_CH.length)];
  return s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8);
}
function normCode(raw) { return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})(.{4})$/, "$1-$2-$3"); }

async function handleShop(req, res, url) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
  if (rateLimited(ip)) return sendJson(res, 429, { error: "しばらく待ってから再試行してください" });

  // 管理: コード発行
  if (req.method === "POST" && url.pathname === "/api/shop/gen") {
    let body; try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!ADMIN_KEY || body.adminKey !== ADMIN_KEY) return sendJson(res, 403, { error: "管理キーが違います" });
    const gems = Math.max(1, Math.min(100000, parseInt(body.gems) || 0));
    const count = Math.max(1, Math.min(200, parseInt(body.count) || 1));
    const store = await loadCodes();
    const issued = [];
    for (let i = 0; i < count; i++) { let c = genShopCode(); while (store.codes[c]) c = genShopCode(); store.codes[c] = { gems, used: false }; issued.push(c); }
    try { store.sha = await ghStoreCodes(store.codes, store.sha); } catch (e) { console.log("codes store fail", e.message); }
    return sendJson(res, 200, { issued, gems, count });
  }

  // 引き換え
  if (req.method === "POST" && url.pathname === "/api/shop/redeem") {
    let body; try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const code = normCode(body.code);
    const store = await loadCodes();
    const rec = store.codes[code];
    if (!rec) return sendJson(res, 404, { error: "コードが見つかりません" });
    if (rec.used) return sendJson(res, 409, { error: "このコードは使用済みです" });
    rec.used = true; rec.usedAt = Date.now();
    // クラウドセーブに直接加算(id+pinがあれば)
    let cloudAdded = false, cloudTotal = null;
    if (body.id && body.pin) {
      const id = normId(body.id);
      const srec = await loadRec(id);
      if (srec && pinHash(id, body.pin) === srec.pinHash && srec.data) {
        srec.data.gems = (srec.data.gems || 0) + rec.gems;
        try { srec.sha = await ghStore(id, { pinHash: srec.pinHash, data: srec.data }, srec.sha); cloudAdded = true; cloudTotal = srec.data.gems; } catch (e) { console.log("cloud add fail", e.message); }
      }
    }
    try { store.sha = await ghStoreCodes(store.codes, store.sha); } catch (e) { console.log("codes update fail", e.message); }
    return sendJson(res, 200, { gems: rec.gems, cloudAdded, cloudTotal });
  }

  return sendJson(res, 404, { error: "not found" });
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }
  if (url.pathname.startsWith("/api/cloud")) {
    handleCloud(req, res, url).catch((e) => { console.log("cloud error", e); sendJson(res, 500, { error: "server error" }); });
    return;
  }
  if (url.pathname.startsWith("/api/shop")) {
    handleShop(req, res, url).catch((e) => { console.log("shop error", e); sendJson(res, 500, { error: "server error" }); });
    return;
  }
  if (url.pathname === "/health" || url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, saves: saves.size, durable: !!(SAVES_TOKEN && SAVES_REPO) }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

// ---- heartbeat（死んだ接続を素早く回収） ----
function heartbeat() { this.isAlive = true; }
wss.on("connection", (ws) => { ws.isAlive = true; ws.on("pong", heartbeat); });
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);

// ============================================================
// ルーム管理
// room = { code, players: [{ws, role, name, token}], createdAt, updatedAt }
//   role: 'host' | 'guest'
// ============================================================
const rooms = new Map();

function genCode() {
  const s = String(Math.floor(100000 + Math.random() * 900000)); // 6桁数字（テンキー入力向け）
  return rooms.has(s) ? genCode() : s;
}
function genToken() { return crypto.randomBytes(12).toString("hex"); }
function isOpen(ws) { return ws && ws.readyState === ws.OPEN; }
function touch(room) { room.updatedAt = Date.now(); }
function send(ws, obj) { if (isOpen(ws)) ws.send(JSON.stringify(obj)); }

function peerOf(room, ws) {
  return room.players.find((p) => p.ws !== ws);
}
function roleName(role) { return role === "host" ? "ホスト" : "ゲスト"; }

wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.role = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type } = msg;

    // ---- 部屋を作る（ホスト） ----
    if (type === "create") {
      const code = genCode();
      const token = genToken();
      const room = {
        code,
        players: [{ ws, role: "host", name: msg.name || "ホスト", token }],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      rooms.set(code, room);
      ws.roomCode = code; ws.role = "host";
      send(ws, { type: "created", code, role: "host", token });
      return;
    }

    // ---- 部屋に入る（ゲスト） ----
    if (type === "join") {
      const code = String(msg.code || "").trim();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: "errmsg", message: "ルームが見つかりません" });

      // 既存ゲスト枠が切断中なら、その枠を引き継いで再接続
      const dead = room.players.find((p) => p.role === "guest" && !isOpen(p.ws));
      if (room.players.length >= 2 && !dead) {
        return send(ws, { type: "errmsg", message: "満室です" });
      }
      const token = genToken();
      if (dead) {
        dead.ws = ws; dead.token = token; dead.name = msg.name || dead.name;
      } else {
        room.players.push({ ws, role: "guest", name: msg.name || "ゲスト", token });
      }
      ws.roomCode = code; ws.role = "guest";
      touch(room);
      send(ws, { type: "joined", code, role: "guest", token });
      // ホストへ参加通知（ホストはこれを受けて初期状態の送信を開始する）
      const host = room.players.find((p) => p.role === "host");
      send(host && host.ws, { type: "peer_joined", name: msg.name || "ゲスト" });
      return;
    }

    // ---- 再接続（同じ部屋・同じトークン） ----
    if (type === "resume") {
      const room = rooms.get(String(msg.code || "").trim());
      if (!room) return send(ws, { type: "resume_failed", reason: "no_room" });
      const player = room.players.find((p) => p.token === msg.token && p.role === msg.role);
      if (!player) return send(ws, { type: "resume_failed", reason: "no_player" });
      player.ws = ws;
      ws.roomCode = room.code; ws.role = player.role;
      touch(room);
      send(ws, { type: "resumed", code: room.code, role: player.role, token: player.token });
      const peer = peerOf(room, ws);
      send(peer && peer.ws, { type: "peer_back", role: player.role });
      // 再接続側は相手に最新状態の再送を要求できるよう、相手へ resync 依頼を投げる
      send(peer && peer.ws, { type: "need_resync" });
      return;
    }

    // ---- それ以外：相手へそのまま転送（state同期・着手・チャット等すべて） ----
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    touch(room);
    const peer = peerOf(room, ws);
    send(peer && peer.ws, msg);
  });

  ws.on("close", () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const p = room.players.find((pp) => pp.ws === ws);
    if (p) p.ws = null;
    const peer = room.players.find((pp) => isOpen(pp.ws));
    send(peer && peer.ws, { type: "peer_left", role: ws.role });
  });
});

// 古い部屋を定期破棄
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - (room.updatedAt || 0) > ROOM_TTL_MS) rooms.delete(code);
    else if (room.players.every((p) => !isOpen(p.ws)) && now - room.updatedAt > 10 * 60 * 1000) rooms.delete(code);
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`モンスターオンライン対戦サーバー起動: ポート ${PORT}`);
});
