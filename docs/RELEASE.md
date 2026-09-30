# リリース手順書（NLH Dealer Trainer）

Web版・無料・ログインなし・独自ドメインで公開するための手順です。
コード側の準備（法務ページ、SEO/OGP、オフライン対応、バックアップ、エラー画面、CI）は完了しています。
残りは **運営者が行う作業** です。

---

## 1. 運営者情報を記入する（必須）

`src/config/site.ts` の次の2項目を実際の値に書き換えます。プライバシーポリシー・利用規約・フッターに表示されます。

```ts
operator: { ja: "【運営者名】", en: "[Operator name]" },   // 例: { ja: "株式会社〇〇", en: "〇〇 Inc." }
contact: "【お問い合わせ先】",                              // 例: "support@example.com" またはフォームのURL
```

- 仮置き（【】）のままデプロイすると、GitHub Actions のログに警告が出ます。
- 個人で運営する場合、氏名の代わりに屋号やサービス名＋連絡用メールアドレスでも構いません（公開範囲はご判断ください）。
- `legalDate`（制定日）も公開日に合わせて更新してください。

## 2. 独自ドメインを取得する

お名前.com、Cloudflare Registrar、Google Domains の後継（Squarespace）などで取得します（年1,000〜3,000円程度）。

- **おすすめ**: サブドメイン運用（例 `trainer.example.jp`）か、専用ドメイン（例 `dealertrainer.jp`）

## 3. DNS を設定する

ドメイン管理画面の DNS 設定で、以下のどちらかを登録します。

### A. サブドメイン（例 `trainer.example.jp`）の場合
| 種類 | ホスト名 | 値 |
|---|---|---|
| CNAME | trainer | `sakayamataiji-tech.github.io` |

### B. ドメイン直下（例 `dealertrainer.jp`）の場合
| 種類 | ホスト名 | 値 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | `sakayamataiji-tech.github.io` |

反映には数分〜最大48時間かかります。

## 4. GitHub の設定

1. **ドメインの所有確認（推奨）**: GitHub の右上アイコン → Settings → Pages → *Add a domain* で所有確認用の TXT レコードを DNS に追加（ドメイン乗っ取り防止）。
2. **リポジトリ変数**: リポジトリ → Settings → Secrets and variables → Actions → *Variables* → `New repository variable`
   - Name: `CUSTOM_DOMAIN`
   - Value: 取得したドメイン（例 `dealertrainer.jp`、`https://` は付けない）
3. **Pages のカスタムドメイン**: リポジトリ → Settings → Pages → *Custom domain* に同じドメインを入力して Save。
4. DNS チェックが通ったら **Enforce HTTPS** にチェック。
5. Actions → *Deploy to GitHub Pages* → *Run workflow* で再デプロイ。

これで `https://<ドメイン>/` で公開されます。旧URL（github.io）は自動で新ドメインへ転送されます。

> ⚠️ 成績データはブラウザごと・URLごとに保存されます。github.io で遊んでいた記録は、新ドメインには自動では引き継がれません。
> 移行前に STATS 画面の「書き出し」でバックアップし、新ドメインで「読み込み」してください。

## 5. ブランチ運用（推奨）

現在は作業ブランチ `claude/charming-archimedes-2ra0ey` が既定ブランチになっています。本番運用では:

1. このブランチから `main` を作成し、Settings → General → *Default branch* を `main` に変更
2. Settings → Branches で `main` にブランチ保護（PR 必須・CI 必須）
3. 以後は PR を作成 → CI（型チェック・テスト・ビルド）が通ったらマージ → `main` への push で自動デプロイ
4. `.github/workflows/deploy.yml` の `branches` から作業ブランチ名を外す

## 6. 公開前チェックリスト

- [ ] 運営者名・連絡先を記入した（`src/config/site.ts`）
- [ ] 独自ドメインで表示され、鍵マーク（HTTPS）が付いている
- [ ] iPhone（Safari）・Android（Chrome）でホーム画面に追加して起動できる
- [ ] 機内モードでも起動・出題できる（一度オンラインで開いた後）
- [ ] 日本語 / English の切り替え
- [ ] プライバシーポリシー・利用規約の内容を確認した
- [ ] SNS でURLを共有した時にプレビュー画像が出る（X の Card Validator 等で確認）
- [ ] Google Search Console にドメインを登録し、`/sitemap.xml` を送信

## 7. 公開後の運用

- **更新**: コードを `main` にマージすると自動デプロイ。利用者の端末では次回起動時に新しい版に切り替わります（オフライン用キャッシュも自動更新）。
- **バージョン**: フッターに `v1.0.0+<commit>` を表示。大きな変更時は `package.json` の `version` を上げてください。
- **アクセス解析を入れる場合**: プライバシーポリシーの「Cookie・アクセス解析」を必ず改定してから導入してください（Cookie 不要の Cloudflare Web Analytics 等がおすすめ）。
- **将来**: ログイン・クラウド保存・有料化・ストアアプリ化を行う場合は、プライバシーポリシーと利用規約の改定が必要です。
