# AtCoder Tools
テストケースのDLやインタラクティブにソースコードのビルドやサンプルでのAC確認ができるツールです。
## Usage
様々な機能がありますが、初期設定をする必要があります。
### 初期設定
`? Enter the path of mainfile:`
ソースコードを記述する場所を決めます。
一応デフォルトで`main.cpp`,`main.py`,`main.rs`を用意していますが、Luaとかのそういう言語を使いたければ各自で用意してください。

`? Enter the build command:`
コンパイラ型言語の場合は指定します。`{MAIN_FILE}`と入力すると、自動的にソースコードのファイルのパスになります。
C++あたりなら`g++ -o out {MAIN_FILE}`が妥当でしょう。Pythonなどのインタプリタ型言語であれば必要ありません。
`index.js`と同じ階層においておくことをお勧めします。

`? Enter the run command:`
実行する為に必要なコマンドを指定します。`{MAIN_FILE}`と入力すると、自動的にソースコードのファイルのパスになります。`{INPUT_FILE}`と入力すると、テストケースになります。
C++であれば`./a.out < {INPUT_FILE}`、Pythonであれば`python {MAIN_FILE} < {INPUT_FILE}`が妥当でしょう。

`? Enter the cookie value: Cookie[https://atcoder.jp]:REVEL_SESSION:`
ブラウザのDevTools > Application > Cookies > https://atcoder.jp から取得できるREVEL_SESSIONの値 (Microsoft Edgeの場合)を取得します。
<span style="color: red; font-size: 35px">トップシークレットです。絶対に外部に公開しないでください。
アカウントを乗っ取られる可能性があります。</span>
※このプロジェクトが信頼できない場合は入力しないでください。

### Set contest
コンテストを指定します。`https://atcoder.jp/contests/abc425`のURLの場合、`abc425`を入力してください。
### Download Testcases
コンテストからテストケースを取得します。ログイン状態でのみダウンロードできるコンテストが存在します。
### Delete Testacases
今setされているコンテストのテストケースを削除します(ダウンロード済みの場合)
### Select problem
今setされているコンテストの問題のうち、解く問題を指定します。
### Build & Test
初期設定に基づき、ビルドしたのちテストします。サンプルでのAC/WA/TLE/REが確認できます。
WAの場合はOutputとExpected、REの場合はエラーを表示します。
### Build
初期設定に基づき、ビルドのみ行います。
### Test
初期設定に基づき、テストを行います。
### Test in any cases
初期設定に基づきテストを行いますが、ケースを任意のものにできます。
### Start auto building and test
ファイルが変更されたとき、ビルドとテストを自動で行います。
#### 基本的な機能
初期設定のmainfileが変更されたとき、ビルド/テストが自動で行われます。
Qキーで終了します。Ctrl+Cでは(なぜか)終了できません。
#### Bキー
何らかの理由でビルドが行われなかった場合、ビルドを行います。
#### Tキー
何らかの理由でテストが行われなかった場合、テストを行います。

## 実行環境
Node.jsはv20.19.5です。ワンチャンそれ以降のverでも動く可能性はあります。
制作者はWSLで行い動作を確認しました。`main.cpp`,`main.py`に書いているサンプルコマンドはすべてWSLのものです。外部コマンド(python、g++)などは各自でインストールしてください。

## セットアップ
```shell
$ npm install
```
で初期インストールを行います。
```shell
$ npm start
```
で実行します。