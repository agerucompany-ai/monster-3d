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

// ---- HTTP（ヘルスチェック。GitHub Actions cron で叩いてスリープ防止） ----
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
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
