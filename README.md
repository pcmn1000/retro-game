# 🎮 一行もコードを書かずに GitHub Copilot でレトロ風ゲームをデプロイしてみた

> すべてのコード生成・環境構築・デプロイ作業を GitHub Copilot（Claude Opus 4.6）が実行しました。  
> 人間が書いたコードは **0行** です。

**スマホでもPCでも遊べます。皆さんも良ければぜひ遊んでみてください！**

👉 **https://yellow-stone-0c8825500.6.azurestaticapps.net**

![ゲーム画面](screenshots/gameplay.png)

## 📖 概要

VS Code の GitHub Copilot Agent Mode（Claude Opus 4.6）を活用し、モバイル対応のレトロ風2Dプラットフォームゲームをゼロから開発し、Azure Static Web Apps にデプロイするまでの全工程を AI に任せました。

自分が行ったのは、「こういうゲームを作りたい」「ここを修正してほしい」「デプロイしたい」といったプロンプトの入力のみです。

## 🧰 前提ツール・環境

GitHub Copilot Agent Mode で開発からデプロイまで完結させるには、以下のツールが事前にセットアップされている必要があります。

| ツール | 用途 | 補足 |
|-------|------|------|
| **VS Code** | エディタ | Agent Mode のホスト環境 |
| **GitHub Copilot** | AI コード生成・操作 | Agent Mode で Claude Opus 4.6 を使用 |
| **Git** | バージョン管理 | Copilot がターミナルで `git` コマンドを実行 |
| **GitHub CLI (`gh`)** | リポジトリ作成・操作 | `gh repo create` 等を Copilot が実行 |
| **Azure CLI (`az`)** | Azure リソース操作 | `az staticwebapp create` 等を Copilot が実行 |
| **Azure サブスクリプション** | ホスティング | Static Web Apps Free プランなら無料 |

重要なのは、**Copilot 自身がこれらのツールをターミナルで呼び出す**という点です。人間がコマンドを覚える必要はありませんが、ツール自体はインストールされている必要があります。

## 🤖 なぜ Claude Opus 4.6 を選んだのか

GitHub Copilot Agent Mode では、使用する LLM モデルを選択できます。今回 Claude Opus 4.6 を選んだ理由：

- **Agent Mode との相性**: ツール呼び出し（ファイル編集、ターミナル実行、検索等）の精度が高く、連続操作を安定してこなせる
- **長いコンテキストの理解**: game.js が 2,000行を超えても、既存コードの構造を理解した上で適切な箇所を修正できる
- **日本語プロンプトへの対応**: 日本語での指示を正確に解釈し、コメントやコミットメッセージも日本語で生成してくれる

## 🔌 MCP Server の活用

VS Code に組み込まれた **MCP（Model Context Protocol）Server** も活用しました。MCP Server は、Copilot Agent Mode がアクセスできるツール群を拡張する仕組みです。

| MCP Server | 用途 | 具体的な使い方 |
|-----------|------|--------------|
| **Azure MCP** | Azure リソース管理 | サブスクリプション情報の取得、リソースの確認、デプロイのベストプラクティス取得 |
| **Microsoft Docs MCP** | 公式ドキュメント検索 | Azure Static Web Apps の仕様確認、API リファレンスの参照 |

通常の Agent Mode ではファイル編集・ターミナル実行・検索といった基本操作しかできませんが、MCP Server を追加することで **Azure リソースの直接操作** や **公式ドキュメントの検索・参照** が可能になります。

## 🎯 完成したゲームの特徴

- **3つのステージ + ボス戦**: 地上 → 地下 → 空中 → ボス戦
- **二段ジャンプ**: 空中でもう一度ジャンプ可能
- **タッチ操作対応**: モバイルブラウザでプレイ可能（仮想十字キー＋ジャンプボタン）
- **キーボード操作**: 矢印キー / WASD + スペースキー
- **コイン収集 & スコアシステム**
- **敵キャラクター**: オリジナルの画像を敵スプライトとして使用
- **ボス戦**: 敵キャラの1.5倍サイズのボスが登場、HPバー付き、3回踏んで撃破
- **パーティクルエフェクト**: ジャンプ・コイン取得・敵撃破時の演出
- **ステージクリア演出**: 旗に触れるとクリア

## 🛠️ 開発プロセス

GitHub Copilot に以下の指示を出し、対話的に開発を進めました。

### Step 1: ゲームの基本構造を作成

**プロンプト:** 「モバイルのWebアプリで動くレトロ風ゲームを開発したい」

このプロンプトひとつで、Copilot が以下の3ファイルを生成しました：
- `index.html` — ゲーム画面・タイトル画面・ゲームオーバー画面の HTML 構造
- `style.css` — モバイル対応のレスポンシブ CSS（safe-area-inset 対応）
- `game.js` — 約1,200行のゲームエンジン（物理演算・衝突判定・3ステージ・敵AI）

### Step 2: ゲーム機能の追加

**プロンプト:** 「二段ジャンプを実装してください」「キャラのスピードは一定にしてください」

- Player クラスに `maxJumps` / `jumpCount` を追加し二段ジャンプを実装
- 加速度・摩擦ベースの移動を一定速度の移動に変更

### Step 3: 敵キャラクターの変更

**プロンプト:** 「敵キャラを添付の画像のキャラクターに変更してください」

- 添付した画像（`enemy.png`）を敵スプライトとして設定
- 画像が読み込めない場合の Canvas 描画フォールバックも実装

### Step 4: タイトル画面・バグ修正・ボス戦追加

**プロンプト:** 「タイトルを可愛くして」「速度バグを直して」「レンガのはみ出しを直して」「ボス戦を追加して」

- タイトル画面に地球キャラ画像をバウンスアニメーション付きで配置
- 死亡後の移動速度が加速するバグを修正
- レンガブロックの描画が右にはみ出す問題をクリッピングで修正
- WORLD 1-3 クリア後にボス戦ステージを追加（HP3。1.5倍サイズのボス）

### Step 5: GitHub リポジトリの作成

**プロンプト:**（Copilot が自動で実行）

```
git init → git add → git commit
gh repo create pcmn1000/retro-game --public
git push
```

リポジトリの作成から push まで、Copilot が一連の流れで実行してくれました。

### Step 6: Azure Static Web Apps へデプロイ

**プロンプト:** 「本格的に公開したい。Azureのサブスクリプションを保有しています」

Copilot が Azure CLI を使って以下を実行：
1. `az group create` — リソースグループ `retro-game-rg` を East Asia に作成
2. `az staticwebapp create` — Azure Static Web Apps（Free プラン）を作成し GitHub リポジトリと連携
3. GitHub Actions ワークフローが自動生成され、`main` ブランチへの push で自動デプロイ

人間が行ったのは、Azure ログイン時のシングルサインオン（SSO）でアカウントを選択したのみです。

## 🔄 アップデート（2026/02/11）

初回デプロイ後、引き続き Copilot への指示のみでゲームの機能追加を行いました。

### 追加した機能

- **レトロ風タイトル画面**: Press Start 2P ピクセルフォント、星空アニメーション、CRT スキャンライン演出
- **ニックネーム & ランキング**: ゲーム開始時にニックネーム入力、ボス撃破後に TOP 10 ランキング表示（localStorage）
- **ブロックバンプ**: 下から叩くとバンプアニメーション → 上の敵が反転して飛んでいく
- **月アイテム改善**: ランダムに左右へ飛び出して落下する物理演算
- **パイプワープ**: World 1-1 / 1-2 のパイプに ▼ で入ると地下コインボーナスエリアへ
- **パイプ暗転トランジション**: 沈む → フェードアウト → ワープ → フェードイン → せり上がるアニメーション

## 🚀 CI/CD：push するだけで自動デプロイ

開発フローの中で特に体験が良かったのは、**CI/CD の仕組みが最初から組み込まれている**点です。

### デプロイフロー

```
プロンプト入力 → Copilot がコード変更
              → Copilot が git add / commit / push を実行
              → GitHub Actions が自動起動
              → Azure Static Web Apps に自動デプロイ（約1〜2分）
```

**「この機能を追加して」と言ったら、数分後には本番環境に反映されている**という体験です。

### 実際の開発サイクル

1. Copilot に機能追加・修正を指示
2. Copilot がコードを編集
3. Copilot が `git add -A && git commit -m "..." && git push` を実行
4. GitHub Actions が起動 → Azure に自動デプロイ
5. ブラウザで動作確認
6. 問題があれば再度 Copilot に指示 → 2 に戻る

**人間の作業はプロンプトの入力とブラウザでの動作確認のみ**です。

## 💡 GitHub Copilot Agent Mode の留意点

### ✅ 良かった点

- **CLI ツールとの相性が抜群**: Azure CLI、GitHub CLI、Git をシームレスに操作
- **反復的な修正が速い**: 修正 → push → 確認 → 再修正のサイクルが高速
- **コンテキストの保持**: セッション内で過去の変更を覚えている

### ⚠️ 留意すべき点

- **プロンプトは具体的に**: 仕様をできるだけ明確に伝えると精度が上がる
- **長いセッションではコンテキストが溢れる**: 関数名を明示したり、段階的に指示すると良い
- **動作確認は人間の目で**: 見た目・体験の判断は人間が行う必要がある
- **ツールの事前セットアップが必要**: `az`、`gh`、`git` 等は事前にインストール

## 📁 ファイル構成

```
retro-game/
├── index.html          # ゲーム UI（HTML）
├── style.css           # スタイル（CSS）
├── game.js             # ゲームエンジン（JavaScript, ~2,200行）
├── enemy.png           # 敵キャラクター画像
├── screenshots/        # スクリーンショット
├── server.ps1          # ローカル開発用サーバー（PowerShell）
├── README.md           # このファイル
└── .github/
    └── workflows/
        └── azure-static-web-apps-*.yml  # 自動デプロイ用 GitHub Actions
```

## 🏗️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | HTML5 Canvas, Vanilla JavaScript, CSS3 |
| フォント | Google Fonts（Press Start 2P） |
| データ保存 | localStorage（ランキング） |
| ホスティング | Azure Static Web Apps（Free プラン） |
| CI/CD | GitHub Actions（Azure 自動生成） |
| ソース管理 | GitHub |
| 開発ツール | VS Code + GitHub Copilot Agent Mode |
| LLM モデル | Claude Opus 4.6 |
| MCP Server | Azure MCP, Microsoft Docs MCP |
| 人間の貢献 | プロンプト入力、動作確認、Azure SSO 認証 |

## ⚠️ 免責事項

このアプリケーションは商用目的ではありません。

## 📝 ライセンス

MIT
