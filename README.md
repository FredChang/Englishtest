# 英文單字練習 (Englishtest)

中英翻譯單字練習應用，支援 CEFR 難度、輸入作答與選擇題模式。

| 平台 | 使用方式 |
|------|----------|
| **Windows** | 用 Visual Studio 開啟 `Englishtest.sln` 建置執行（WPF 桌面版） |
| **iPhone / Android** | 透過瀏覽器開啟網頁版，可「加到主畫面」像 App 一樣使用 |

## 手機版（網頁 / PWA）

`web/` 資料夾為行動裝置用的網頁版，功能包含：

- 中翻英 / 英翻中
- 輸入作答與選擇題
- CEFR 難度與題數設定
- 發音播放（瀏覽器語音合成 + 線上音檔）
- 字根提示（來自 `words.json`）

### 本機預覽

在專案根目錄執行（需先複製題庫）：

```powershell
Copy-Item words.json web\words.json -Force
cd web
python -m http.server 8080
```

手機與電腦連同一 Wi‑Fi 時，用手機瀏覽器開啟 `http://<你的電腦IP>:8080`。

### 上傳 GitHub 並讓手機使用

1. **建立 GitHub 倉庫**（例如名稱 `Englishtest`）。

2. **在本機初始化並推送**（將 `YOUR_USERNAME` 換成你的 GitHub 帳號）：

```powershell
cd C:\Users\aggyy\source\repos\Englishtest
Copy-Item words.json web\words.json -Force
git init
git add .
git commit -m "Add English vocabulary app with mobile web version"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Englishtest.git
git push -u origin main
```

3. **啟用 GitHub Pages**
   - 進入 GitHub 倉庫 → **Settings** → **Pages**
   - **Build and deployment** → Source 選 **GitHub Actions**
   - 推送 `main` 分支後，`.github/workflows/deploy-pages.yml` 會自動部署

4. **手機開啟網址**

```
https://YOUR_USERNAME.github.io/Englishtest/
```

5. **加到主畫面（像 App）**
   - **iPhone（Safari）**：分享 → **加入主畫面**
   - **Android（Chrome）**：⋮ 選單 → **安裝應用程式** 或 **加到主畫面**

### 更新題庫後

修改根目錄的 `words.json` 後，同步到手機版再推送：

```powershell
Copy-Item words.json web\words.json -Force
git add words.json web/words.json
git commit -m "Update vocabulary"
git push
```

GitHub Actions 部署時也會自動從根目錄複製 `words.json` 到 `web/`。

## Windows 桌面版建置

- 需求：Visual Studio 2019+、.NET Framework 4.8.1
- 開啟 `Englishtest.sln` → 建置 → 執行
- 發行：`bin\Release\Englishtest.exe`（需一併包含 `words.json`）

## 專案結構

```
Englishtest/
├── web/                 # 手機／瀏覽器版（GitHub Pages 部署來源）
├── words.json           # 題庫（桌面版與網頁版共用）
├── Englishtest.sln      # Windows WPF 方案
└── .github/workflows/   # 自動部署 GitHub Pages
```

## 授權

個人學習使用。題庫內容請依實際來源自行確認使用權限。
