<div id="top"></div>

# 2025 年度研究室配属システム

<img src="https://img.shields.io/badge/node-v22.14.0-green.svg"><img src="https://img.shields.io/badge/npm-v11.3.0-green.svg">

## 目次

├ [📛 名称](#名称)\
├ [🔧 技術スタック](#技術スタック)\
｜　 ├ [フロントエンド](#フロントエンド)\
｜　 ├ [バックエンド](#バックエンド)\
｜　 └ [環境](#環境)\
├ [📦firebase-firestore](#firebase-firestore)\
｜　 ├ [labs コレクション](#labs-コレクション)\
｜　 ├ [entries コレクション](#entries-コレクション)\
｜　 └ [special_gpa コレクション](#special_gpa-コレクション)\
├ [⚙️ 機能仕様](#機能仕様)\
｜　 ├ [システム全体について](#システム全体について)\
｜　 ├ [認証について](#認証について)\
｜　 ｜ ├ [教員保持 DB](#教員保持-db)\
｜　 ｜ └ [世話人保持 DB](#世話人保持-db)\
｜　 ├ [特殊 GPA の算出について](#特殊-gpa-の算出について)\
｜　 └ [セキュリティについて](#セキュリティについて)\
｜　　 ├ [クライアント側](#クライアント側)\
｜　　 └ [ホスト側](#ホスト側)\
└ [💻 運用方法](#運用方法)

## 名称

2025 年度静岡大学情報学部情報科学科 3 年生を対象とする勾配付き特殊 GPA を利用した研究室配属システム

## 技術スタック

- ### フロントエンド

  <!-- javascript -->
  <img src="https://shields.io/badge/JavaScript-F7DF1E?logo=JavaScript&logoColor=000&style=for-the-badge">
  <!-- html -->
  <img src="https://shields.io/badge/HTML-f06529?logo=html5&logoColor=white&labelColor=f06529&style=for-the-badge">

- ### バックエンド

  <!-- firebase -->
  <img src="https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black">

- ### 環境

  <!-- nodejs -->
  <img src="https://img.shields.io/badge/Node.js-000000.svg?logo=node.js&style=for-the-badge">
  <!-- webpack -->
  <img src="https://img.shields.io/badge/-Webpack-8DD6F9?style=for-the-badge&logo=webpack&logoColor=white">
  <!-- chromium -->
  <img src="https://img.shields.io/badge/Chromium-ffffff.svg?logo=googlechrome&style=for-the-badge">
  <!-- google gemini -->
  <img src="https://img.shields.io/badge/google gemini-ffffff.svg?logo=googlegemini&style=for-the-badge&logoColor=blue">

## Firebase-firestore

### labs コレクション

| フィールド名 | 型      | 説明                 |
| ------------ | ------- | -------------------- |
| id           | number  | 研究室 ID            |
| name         | string  | 研究室名             |
| isEntryOpen  | boolean | エントリー可能フラグ |
| capacity     | number  | 定員数               |

### entries コレクション

| フィールド名 | 型        | 説明                      |
| ------------ | --------- | ------------------------- |
| author_uid   | string    | ユーザの Firebase 認証 ID |
| labId        | number    | エントリーした研究室 ID   |
| labName      | string    | エントリーした研究室名    |
| status       | string    | 選考状況                  |
| createdAt    | timestamp | エントリ―日時             |

### special_gpa コレクション

| フィールド名 | 型        | 説明                      |
| ------------ | --------- | ------------------------- |
| author_uid   | string    | ユーザの Firebase 認証 ID |
| specialGpa   | number    | 特殊 GPA                  |
| submittedAt  | timestamp | 送信日時                  |

## 機能仕様

### システム全体について

本システムは Chromium ベースのブラウザを対象としたクライアント直結型の拡張機能として提供される．  
データの保存及び管理には Google Firebase が利用され，認証も同様である．

### 認証について

認証は admin によって登録されたメールアドレスとパスワードによって実行される．  
配属システムにおいては個人情報保護の観点より，以下のようにメールアドレスとパスワードを管理する．

#### 教員保持 DB

| フィールド名         | 型     | 説明                                    |
| -------------------- | ------ | --------------------------------------- |
| 学生情報             | any    | 学生が特定できる一意の情報(ex:学籍番号) |
| 認証用メールアドレス | string | ランダムに作成されたメールアドレス      |
| 認証用パスワード     | string | ランダムに作成されたパスワード          |

#### 世話人保持 DB

| フィールド名  | 型     | 説明                                         |
| ------------- | ------ | -------------------------------------------- |
| 特殊 GPA      | number | 今回算出した配属専用の GPA                   |
| 認証ユーザ ID | string | Firebase 認証によって自動生成されるユーザ ID |

| フィールド名         | 型     | 説明                                         |
| -------------------- | ------ | -------------------------------------------- |
| 認証用メールアドレス | string | ランダムに作成されたメールアドレス           |
| 認証用パスワード     | string | ランダムに作成されたパスワード               |
| 認証ユーザ ID        | string | Firebase 認証によって自動生成されるユーザ ID |

このように情報の分割を行うことで世話人サイドでの個人と GPA の結びつきを防止する．

<div style="page-break-before:always"></div>

### 特殊 GPA の算出について

研究室配属を目的とした特定科目における倍率付与型 GPA（以下，特殊 GPA とする）は以下によって定義される．  
特定科目の GP を対象に独自の倍率を付与する．  
科目情報は [README2023](https://www.shizuoka.ac.jp/education/affairs/handbook/document/2023/2023_BA_7inf_1All_pub.pdf) を参照した．

| 情報学部情報科学科専門科目 |      | 1 年度 | 2 年度 |
| -------------------------- | ---- | ------ | ------ |
|                            |      | x1.1   | x1.2   |
| 必修科目                   | x1.0 | x1.1   | x1.2   |
| 選択必修科目               | x1.1 | x1.21  | x1.32  |
| 選択科目                   | x1.2 | x1.32  | x1.44  |

対象とする科目は以下の通りである．
| 科目名 | 科目コード | 分類 | 年度 |
| ------------------------------ | ---------- | -------- | ---- |
| 微分積分学 1 | 76010050 | 必修 | 1 |
| 微分積分学 2 | 76010070 | 選択必修 | 1 |
| 線形代数学 1 | 76010010 | 必修 | 1 |
| 線形代数学 2 | 76010030 | 必修 | 1 |
| グラフ理論 | 76020090 | 必修 | 1 |
| 集合確率 | 77451010 | 必修 | 1 |
| 数理論理 1 | 77451020 | 必修 | 1 |
| 数理論理 2 | 77453010 | 選択必修 | 1 |
| 認知科学 | 77405020 | 選択必修 | 1 |
| 統計学入門 | 77405010 | 選択 | 1 |
| 情報理論 | 77401100 | 必修 | 2 |
| 計算機アーキテクチャ 1 | 77451070 | 必修 | 2 |
| アルゴリズムとデータ構造 | 77451040 | 必修 | 2 |
| 論理回路 | 77401130 | 必修 | 2 |
| プログラミング方法論 | 77401150 | 必修 | 2 |
| オートマトンと言語理論 | 77451080 | 必修 | 2 |
| コンピュータネットワーク | 77401180 | 必修 | 2 |
| モデリング | 77451100 | 必修 | 2 |
| 信号処理基礎 | 77451120 | 必修 | 2 |
| 人工知能概論 | 77451110 | 必修 | 2 |
| 知能科学 | 77453100 | 選択必修 | 2 |
| 符号理論 | 76020110 | 選択必修 | 2 |
| ディジタル信号処理 | 77403040 | 選択必修 | 2 |
| 応用プログラミング A | 77453050 | 選択必修 | 2 |
| 応用プログラミング B | 77453060 | 選択必修 | 2 |
| 応用プログラミング C | 77453070 | 選択必修 | 2 |
| 計算理論 | 77453080 | 選択必修 | 2 |
| データベースシステム論 | 77403030 | 選択必修 | 2 |
| コンパイラ | 77453090 | 選択必修 | 2 |
| 先端情報学実習 1-a | 77405090 | 選択 | 2 |
| 先端情報学実習 1-b | 77405100 | 選択 | 2 |
| 多変量解析 | 77455020 | 選択 | 2 |
| 知的情報システム開発 1 | 77455050 | 選択 | 2 |
| 社会モデル | 77405290 | 選択 | 2 |
| サイバーフィジカルシステム基礎 | 77455070 | 選択 | 2 |
| 情報と法 | 77455080 | 選択 | 2 |

### セキュリティについて

#### クライアント側

クライアント側にて，エントリ―の際に特殊 GPA チェックを行い，登録情報と 0.2 以上の差異が生じる場合にはエントリーを禁止している．

セキュリティは，DB 側にて firestore のルールを以下の様に定めた．

```
service cloud.firestore {
  match /databases/{database}/documents {

    // 認証トークン: ログイン試行中の未認証ユーザーでも読み取りを許可
    match /auth_token/token {
      allow read: if true;
      allow write: if false;
    }

    // 研究室リスト: 認証済みのユーザーなら誰でも読み取り可能
    match /labs/{labId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // GPA情報: 自分のデータのみ読み書き可能
    match /special_gpa/{gpaId} {
      // 読み取り: 自分のUIDと一致するドキュメントのみ許可
      allow get, list: if request.auth.uid == resource.data.author_uid;

      // 書き込み: 自分のUIDで新しいドキュメントを作成することのみ許可
      allow create: if request.auth.uid == request.resource.data.author_uid;

      allow update, delete: if false;
    }

    // エントリー情報: 自分のデータのみ読み書き可能
    match /entries/{entryId} {
      // 読み取り: 自分のUIDと一致するドキュメントのみ許可
      allow get, list: if request.auth.uid == resource.data.author_uid;

      // 書き込み: 自分のUIDで新しいドキュメントを作成することのみ許可
      allow create: if request.auth.uid == request.resource.data.author_uid;

      allow update, delete: if false;
    }
```

クライアント側にて，以下のセキュリティを実装した．

- DOM 対策
  DOM(Document Object Model)の上書き実行による

## 運用方法

このリポジトリを`git fork`し，ローカルにて`npm install`を実行する． \
改変を行ったら`npm run build`にてビルドし，`/dist/`内のファイルを拡張機能として読み込む． \
`firebase-config.js`にて任意の firebase の認証情報を記載すること． \
`git push origin main`にて GitHub-Workflow が発火し，システム公開用のリポジトリに自動ビルドされる．
