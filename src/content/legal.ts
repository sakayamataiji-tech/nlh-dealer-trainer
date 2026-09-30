/**
 * Privacy policy and terms of use (ja / en). They describe how the app actually works:
 * no accounts, no server, no cookies, no analytics; progress stays in the browser.
 * Update them if analytics, accounts or payments are added.
 */
import { SITE } from "@/config/site";
import type { Lang } from "@/i18n/messages";

export interface LegalSection {
  heading: string;
  body: string[];
}
export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const ghPrivacy = "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement";

export function privacyPolicy(lang: Lang): LegalDoc {
  const op = SITE.operator[lang];
  if (lang === "ja") {
    return {
      title: "プライバシーポリシー",
      intro: `${op}（以下「運営者」）は、${SITE.name}（以下「本サービス」）における利用者情報の取り扱いを以下のとおり定めます。`,
      sections: [
        { heading: "1. 取得する情報", body: ["本サービスは、氏名・メールアドレス等の個人情報を取得しません。アカウント登録やログインの機能はありません。"] },
        {
          heading: "2. 端末内に保存される情報",
          body: [
            "トレーニングの成績（回答結果・回答時間・難易度・設定・言語など）は、利用者のブラウザのローカルストレージにのみ保存され、運営者のサーバー等に送信されることはありません。",
            "オフラインでも利用できるよう、本サービスのプログラムや画像をブラウザのキャッシュ（Service Worker）に保存します。",
            "これらのデータは、ブラウザのサイトデータ削除や、本サービスの STATS 画面の「RESET DATA」で削除できます。",
          ],
        },
        { heading: "3. Cookie・アクセス解析", body: ["本サービスは Cookie を使用せず、アクセス解析ツールや広告も利用していません。導入する場合は本ポリシーを改定してお知らせします。"] },
        {
          heading: "4. ホスティング",
          body: [`本サービスは GitHub Pages（GitHub, Inc.）で配信されています。配信にあたり、GitHub がセキュリティ等の目的で IP アドレス等のアクセス記録を取得する場合があります。詳しくは GitHub のプライバシーステートメント（${ghPrivacy}）をご確認ください。`],
        },
        { heading: "5. 改定", body: ["本ポリシーは必要に応じて改定することがあります。重要な変更は本サービス上でお知らせします。"] },
        { heading: "6. お問い合わせ", body: [`本ポリシーに関するお問い合わせ: ${SITE.contact}`] },
      ],
    };
  }
  return {
    title: "Privacy Policy",
    intro: `This policy explains how ${op} (the "Operator") handles information in ${SITE.name} (the "Service").`,
    sections: [
      { heading: "1. Information we collect", body: ["The Service does not collect personal information such as your name or email address. There are no accounts or logins."] },
      {
        heading: "2. Data stored on your device",
        body: [
          "Your training results (answers, answer times, difficulty, settings, language, etc.) are stored only in your browser's local storage and are never sent to the Operator.",
          "To work offline, the Service stores its program files and images in your browser cache (Service Worker).",
          "You can delete this data by clearing the site data in your browser or with RESET DATA on the STATS screen.",
        ],
      },
      { heading: "3. Cookies and analytics", body: ["The Service uses no cookies, analytics tools or advertising. If this changes, this policy will be updated first."] },
      {
        heading: "4. Hosting",
        body: [`The Service is served by GitHub Pages (GitHub, Inc.). GitHub may log access information such as IP addresses for security purposes. See the GitHub General Privacy Statement (${ghPrivacy}).`],
      },
      { heading: "5. Changes", body: ["This policy may be updated. Important changes will be announced in the Service."] },
      { heading: "6. Contact", body: [`Questions about this policy: ${SITE.contact}`] },
    ],
  };
}

export function termsOfUse(lang: Lang): LegalDoc {
  const op = SITE.operator[lang];
  if (lang === "ja") {
    return {
      title: "利用規約",
      intro: `本規約は、${op}（以下「運営者」）が提供する ${SITE.name}（以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。`,
      sections: [
        { heading: "1. サービス内容", body: ["本サービスは、ノーリミット・ホールデムのディーラー業務（役判定・勝者判定・ポット計算・サイドポット計算）を練習するための無料のトレーニングツールです。"] },
        {
          heading: "2. 免責事項",
          body: [
            "本サービスの問題と正解はルールエンジンにより算出していますが、その正確性・完全性を保証するものではありません。",
            "プレイヤーの行動は、ゲーム理論に基づく戦略を簡略化した近似であり、実際の最適戦略とは異なる場合があります。",
            "ハウスルールは店舗・大会により異なります。実際の業務では各店舗・大会のルールに従ってください。",
            "本サービスの利用により生じた損害について、運営者は故意または重過失がある場合を除き責任を負いません。",
          ],
        },
        { heading: "3. 禁止事項", body: ["法令または公序良俗に反する行為、本サービスの運営を妨げる行為、本サービスを賭博の目的で利用する行為を禁止します。"] },
        { heading: "4. 知的財産権", body: ["本サービスに関する著作権その他の権利は運営者または正当な権利者に帰属します。"] },
        { heading: "5. サービスの変更・停止", body: ["運営者は、事前の通知なく本サービスの内容を変更し、または提供を停止することがあります。端末に保存された成績データが失われた場合でも、運営者は責任を負いません。"] },
        { heading: "6. 規約の変更", body: ["運営者は本規約を変更することがあります。変更後の規約は本サービス上に掲載した時点で効力を生じます。"] },
        { heading: "7. 準拠法・管轄", body: ["本規約は日本法に準拠し、本サービスに関する紛争は運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。"] },
        { heading: "8. お問い合わせ", body: [`お問い合わせ: ${SITE.contact}`] },
      ],
    };
  }
  return {
    title: "Terms of Use",
    intro: `These terms set the conditions for using ${SITE.name} (the "Service") provided by ${op} (the "Operator"). By using the Service you agree to them.`,
    sections: [
      { heading: "1. The Service", body: ["The Service is a free training tool for No-Limit Hold'em dealing skills: hand reading, winner judgment, pot and side pot calculation."] },
      {
        heading: "2. Disclaimer",
        body: [
          "Questions and answers are computed by a rules engine, but their accuracy and completeness are not guaranteed.",
          "Player actions follow a simplified approximation of game-theory-based strategy and may differ from true optimal play.",
          "House rules differ between rooms and events. At work, always follow the rules of your room or event.",
          "Except in cases of intent or gross negligence, the Operator is not liable for damages arising from use of the Service.",
        ],
      },
      { heading: "3. Prohibited use", body: ["Unlawful use, interfering with the Service, and using the Service for gambling purposes are prohibited."] },
      { heading: "4. Intellectual property", body: ["Copyright and other rights in the Service belong to the Operator or the rightful owners."] },
      { heading: "5. Changes and suspension", body: ["The Operator may change or stop the Service without notice. The Operator is not responsible for loss of results stored on your device."] },
      { heading: "6. Changes to these terms", body: ["These terms may be changed. Changed terms take effect when posted in the Service."] },
      { heading: "7. Governing law", body: ["These terms are governed by the laws of Japan. The court with jurisdiction over the Operator's location has exclusive jurisdiction in the first instance."] },
      { heading: "8. Contact", body: [`Contact: ${SITE.contact}`] },
    ],
  };
}
