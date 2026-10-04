# Supabase セットアップ手順（店舗向け機能）

アカウント・店舗・成績のクラウド同期に使う Supabase の準備手順です。

## 1. プロジェクトを作る
1. https://supabase.com でサインアップ → **New project**
2. Region: **Northeast Asia (Tokyo)**（日本と英語圏の両方なら Tokyo か US East のどちらか一方）
3. Database password は安全な場所に保管

## 2. データベースを作る
1. 左メニュー **SQL Editor** → New query
2. `supabase/migrations/0001_teams.sql` の中身を貼り付けて **Run**
   - 作られるもの: profiles / organizations（店舗）/ memberships（所属と役割）/ answer_records（成績）
   - すべての表で Row Level Security が有効。本人のデータと、オーナー・トレーナーとして所属する店舗のスタッフの成績しか見えません。

## 3. ログイン方法を設定する
- **Authentication → Providers → Email**: 有効（パスワード不要の「マジックリンク」でログイン）
- **Google**（任意）: Google Cloud で OAuth クライアントを作成して設定
- **Authentication → URL Configuration**
  - Site URL: 本番URL（例 `https://dealertrainer.jp`）
  - Redirect URLs: 本番URL と `http://localhost:3000`

## 4. 接続情報をアプリに渡す
**Project Settings → API** にある次の2つを使います（どちらも公開して問題ない値です。`service_role` キーは絶対に渡さないでください）。

| 値 | 置き場所 |
|---|---|
| Project URL | GitHub → Settings → Secrets and variables → Actions → **Variables** に `SUPABASE_URL` |
| anon public key | 同じく **Variables** に `SUPABASE_ANON_KEY` |

## 5. 開発環境からの接続を許可する
Claude Code のクラウド環境から動作確認するため、環境設定の Network access で
`<project-ref>.supabase.co`（Project URL のホスト名）を許可してください。
