# モンスター戦略3D

9×9の地形盤でモンスター150体を進化・融合させ、相手の城を落とすボードゲーム。
単一HTML（three.js・画像base64埋め込み・オフライン動作）。**対CPU**と**オンライン対戦**の両対応。

- `index.html` … ゲーム本体（`../files (4)/files (5)/monster-3d.template.html` を `assemble.py` でビルドしたもの）
- `server/` … オンライン対戦用の WebSocket 中継サーバー（ルールを持たない汎用2人ルーム中継）
- `render.yaml` … 静的クライアント(monster-3d) ＋ 中継サーバー(monster-3d-server) の2サービス構成

## オンライン対戦の仕組み（ホスト権威＋ミラー）
部屋を作った側(ホスト)のブラウザが権威的な対局状態を持ち、相手(ゲスト)は着手を送るだけ。
状態はミラー（座標反転＋陣営入替）で同期するので、両者とも「自分=手前=青」で同じUIが動く。
サーバーは `create`/`join`/`resume` 以外を相手へ素通し転送するだけ。

## サーバーのデプロイ
Render で **New → Web Service** → このリポジトリ → **Root Directory = `server`** /
Name = **`monster-3d-server`**（クライアントの `DEFAULT_WS` と一致させる）/ Build `npm install` / Start `npm start`。
URL が別名になった場合は、ゲーム内タイトル→オンライン対戦→「サーバー設定」に `wss://...` を入れる。

`/health` を5分ごとに叩く keepalive（`.github/workflows/keepalive.yml`）で無料枠のスリープを防止。
