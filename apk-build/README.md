# 安卓 App 壳（apk-build）

一个**纯 WebView 壳**：MainActivity 加载 `https://aiim.de5.net`，网页怎么改，App 内立刻就是新版；
只有壳自身的行为（返回键、导出落盘、系统栏配色、权限）需要重新出包。

## 与原 bubblewrap 工程的关系（重要）

这个目录最初由 `npx @bubblewrap/cli init` 生成（TWA = Chrome 自定义标签页）。
现在改成 WebView 壳，**已经手工改过**这些文件，`npx bubblewrap build` / `update` 会覆盖掉它们：

| 文件 | 现状 |
|---|---|
| `app/src/main/java/net/aiim/infodesk/MainActivity.java` | 唯一的 Activity，壳的全部逻辑（加载态/错误页/导出桥/返回键/主题） |
| `app/src/main/AndroidManifest.xml` | 只留 MainActivity；TWA 的 LauncherActivity / DelegationService / FileProvider 已删 |
| `app/build.gradle` | 去掉 bubblewrap 的 `twaManifest` 映射块与 shortcut 生成任务，只依赖 androidx |
| `build.gradle` | 去掉已关停的 `jcenter()` |
| `app/src/main/res/values/{colors,styles}.xml` | 壳配色与启动底色（v10 Fluent token） |
| `twa-manifest.json` | **仅作历史记录**，不再驱动构建；里面的颜色/版本号是给人看的 |

`LauncherActivity.java` / `DelegationService.java` / `manifest-checksum.txt` / `res/xml/shortcuts.xml` /
`res/drawable-*` 的 splash 图已删除（TWA 专用，删掉后 APK 里不再带这些资源）。

## 构建（本机已验证）

```bash
cd apk-build
JAVA_HOME=$HOME/.bubblewrap/jdk ./gradlew --no-daemon assembleRelease
# 产物：app/build/outputs/apk/release/app-release-unsigned.apk（未签名）
```

- JDK 用 `~/.bubblewrap/jdk`（17），不要用系统的 Java 25：Gradle 8.11.1 不支持它。
- SDK 路径在 `local.properties`（`sdk.dir=~/.bubblewrap/android-sdk`）。
- `compileSdk`/`targetSdk` = **36**：Google Play 自 2026-08-31 起要求新应用与更新必须 target API 36。
  AGP 仍是 8.9.1（比它「认识」的上限新一档），靠 `gradle.properties` 的
  `android.suppressUnsupportedCompileSdk=36` 放行；要升 AGP 得同时升 Gradle wrapper。
- 若远端仓库拉取偶发失败（TLS handshake），重跑一次即可；AndroidX 依赖第一次构建会下载并进缓存。

## 出正式包（签名）

```bash
cd apk-build
KEYSTORE_PASS='<keystore 密码>' ./build-release.sh
```

脚本做三件事：`zipalign` → `apksigner`（v1+v2+v3，并生成 .idsig）→ 覆盖 `public/app/infodesk.apk`。
发布前把 `app/build.gradle` 的 `versionCode` 加一（**必须递增**，否则已安装用户升级会失败）。

> ⚠️ **`infodesk.keystore` 没有进 git（.gitignore 里有），请自己离线备份**。
> 它丢了就再也签不出能被老用户覆盖安装的新包，只能让所有人卸载重装。
> 签名指纹必须与 `public/.well-known/assetlinks.json` 里的 `sha256_cert_fingerprints` 一致，
> 换签名后要同步改那个文件（`apksigner verify --print-certs` 可读当前包的指纹）。

## 壳里做了哪些「网页做不到」的事

| 能力 | 为什么必须原生 | 网页侧对应代码 |
|---|---|---|
| 导出落盘（CSV/Excel/备份 JSON/图表 PNG） | WebView 不处理 `blob:` / `data:` 下载，`a[download]` 静默失效 | `src/utils/androidShell.ts` → `AndroidDownload.save(name, base64)` |
| 状态栏/导航栏配色 | 系统栏是原生画的，网页切深浅主题时得回传 | `AndroidShell.setTheme('light'\|'dark')`（`src/main.tsx` 调用） |
| 返回键＝关掉最上面那层 | Android 16 起 `onBackPressed` 不再被调用，必须走 `OnBackPressedDispatcher` | 壳只把返回键翻译成 WebView 的 `goBack()`，真正的层级栈在 `src/utils/backButton.ts` |
| `<input type="file">` | 不实现 `onShowFileChooser` 时点开文件框没反应 | `ImportExport` / `SettingsPage` / `AIPanel` 的隐藏 input |
| 写「下载」目录 | Android 10+ 走 MediaStore，6–9 需要运行时写权限 | 无（壳内部处理，拒绝授权时退回应用私有目录） |
| 麦克风权限（面对面传输） | 浏览器在没有录音权限时会把内网地址换成 `.local`（mDNS）名字，同 Wi-Fi 直连经常失败；只有拿到权限才暴露真实内网地址 | `src/utils/p2pTransfer.ts` 的 `primeMediaPermission()` → 壳在 `onPermissionRequest` 里申请 `RECORD_AUDIO` 后再放行网页请求 |
| 边到边 inset | Android 15+ 强制 edge-to-edge，不处理 inset 状态栏会压住网页 app bar | 无（壳把系统栏高度垫在 WebView 外面） |

## 已知边界

- **壳内没有系统通知**：纯 WebView 不实现 Web Notification API，所以 `__reminder` 的到点提醒在 App 里
  只在应用打开期间生效（网页侧 `notificationSupported()` 会如实显示「此环境不支持」，不会假装成功）。
  要做真提醒得接 FCM + 一个原生 Service，属于独立立项。
- **面对面传输在壳内已支持**（1.2.1 起）：网页在「多设备同步」里先解释「下一步会请求一次麦克风权限」，
  用户点开始传输时壳才申请系统权限（`onPermissionRequest` → `RECORD_AUDIO`），拿到后立即放行网页的
  `getUserMedia`，且只放行**主站的麦克风**（摄像头与其它资源一律拒绝）。网页拿到流立刻停掉，不录音。
  - 用户拒绝时：壳给一句 toast 说明影响，网页按原有逻辑降级（可能走 mDNS，失败页会告诉他重新授权）。
  - ⚠️ 若以后要上架 Google Play，`RECORD_AUDIO` 属于敏感权限，商店里要填写用途说明
    （实际用途：不录音，只为让浏览器交出真实内网地址以完成局域网直连）。
- **单次导出超过 24 MB 不走原生桥**（base64 过桥的内存放大太狠），会退回网页路径并提示改用浏览器。
