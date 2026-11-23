package net.aiim.infodesk;

import android.Manifest;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 纯 WebView 主活动：加载主站，带加载态 + 出错重试，库内只依赖 androidx。
 *
 * 关键点（都是踩过的坑，改动前请先读 apk-build/README.md）：
 *  1. AndroidManifest 必须显式声明 INTERNET 权限——本工程不含 TWA 依赖，
 *     没有清单合并替我们带入它，缺失时全部请求 net::ERR_ACCESS_DENIED，永久白屏。
 *  2. 导出的 CSV / Excel / 备份是 blob: URL，图表 PNG 是 data: URL，两者在裸 WebView 里
 *     都静默失效，因此需要 JS 桥（AndroidDownload.save）+ 页面侧兜底钩子；
 *     网页侧 `downloadBlob` 会优先直连这个桥（见 src/utils/androidShell.ts）。
 *  3. 导入用的 <input type=file> 不实现 onShowFileChooser 时点了没反应。
 *  4. targetSdk 36（Google Play 2026-08-31 起的要求）在 Android 16 上：
 *     - 强制 edge-to-edge、且 windowOptOutEdgeToEdgeEnforcement 已失效 → 必须自己处理 inset，
 *       否则状态栏会压住网页顶部的 app bar；
 *     - 预测性返回默认开启、onBackPressed() 不再被调用 → 必须改用 OnBackPressedDispatcher，
 *       否则返回键会直接退出应用（弹层再也关不掉）。
 *  5. 状态栏 / 导航栏 / 启动底色跟随网页主题：网页在切换主题时通过 AndroidShell.setTheme 回传，
 *     冷启动则读上次记住的值（默认深色，与网页 bootMode 一致）。
 */
public class MainActivity extends ComponentActivity {

    /** 站点地址由 res/values 的 launchUrl 提供（见 app/build.gradle），host 从它推导，避免两处各写一份 */
    private String launchUrl;
    private String host;
    /**
     * 追加到 User-Agent 末尾，让网页能认出「我在 App 壳里」。
     * 网页侧对应 src/utils/platform.ts 的 APP_UA_TOKEN，两边必须一致（网页只比对前缀）。
     */
    private static final String APP_UA_TOKEN = "InfoDeskApp/1.2.0";
    private static final int REQ_FILE = 1001;
    private static final int REQ_WRITE = 1002;

    private static final String PREFS = "shell";
    private static final String KEY_THEME = "theme";

    // v10 Fluent token 的等价色，与 src/theme/win11.ts 同源（改色请同步两处）
    private static final int DARK_CANVAS = 0xFF202020;   // colorNeutralBackground2
    private static final int DARK_TEXT = 0xFFD6D6D6;     // colorNeutralForeground2
    private static final int DARK_BRAND = 0xFF4CC2FF;    // colorBrandBackground
    private static final int LIGHT_CANVAS = 0xFFF3F3F3;  // colorNeutralBackground2
    private static final int LIGHT_TEXT = 0xFF5C5C5C;    // colorNeutralForeground2
    private static final int LIGHT_BRAND = 0xFF0067C0;   // colorBrandBackground

    private WebView webView;
    private FrameLayout root;
    private View loadingLayer;
    private View errorLayer;
    private TextView errorText;
    private TextView tipView;
    private ProgressBar spinner;
    private Button retryButton;
    private ValueCallback<Uri[]> filePathCallback;
    /** 渲染进程被系统回收后 webView 已不可用，重试要走重建 */
    private boolean rendererGone = false;
    /** 等到写权限授予后再落盘的导出内容（Android 6–9 需要运行时申请写权限） */
    private String pendingName;
    private byte[] pendingBytes;
    private String theme = "dark";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        launchUrl = getString(R.string.launchUrl);
        Uri parsed = Uri.parse(launchUrl);
        host = parsed.getHost() == null ? "" : parsed.getHost();
        theme = prefs().getString(KEY_THEME, "dark");
        buildUi();
        applyTheme(theme);
        configureWebView();
        configureBackNavigation();

        setContentView(root);
        webView.loadUrl(launchUrl);
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    // ───────────────────────── 布局 ─────────────────────────

    private void buildUi() {
        // 纯代码布局：库内零 XML，改样式只需要动本文件
        webView = new WebView(this);
        root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        loadingLayer = buildLoading();
        root.addView(loadingLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        errorLayer = buildError();
        root.addView(errorLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // edge-to-edge（Android 11+，Android 15+ 强制）下把系统栏高度让出来给内容：
        // 返回未消费的 insets，让 WebView 自己也不去处理；键盘弹出时用 ime 的 bottom。
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return insets;
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(0, bars.top, 0, Math.max(bars.bottom, ime.bottom));
            return insets;
        });
    }

    private View buildLoading() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        spinner = new ProgressBar(this);
        box.addView(spinner, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        tipView = new TextView(this);
        tipView.setText("正在加载…");
        tipView.setTextSize(14);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = 16;
        box.addView(tipView, tp);
        return box;
    }

    private View buildError() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        errorText = new TextView(this);
        errorText.setTextSize(15);
        errorText.setGravity(Gravity.CENTER);
        box.addView(errorText, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        retryButton = new Button(this);
        retryButton.setText("重新加载");
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rp.topMargin = 24;
        box.addView(retryButton, rp);
        retryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                restart();
            }
        });
        box.setVisibility(View.GONE);
        return box;
    }

    // ───────────────────────── 主题 ─────────────────────────

    /** 网页切主题时由 JS 桥调用；冷启动时用上次记住的值，避免深浅闪烁。 */
    private void applyTheme(String mode) {
        final boolean light = "light".equals(mode);
        theme = light ? "light" : "dark";
        final int canvas = light ? LIGHT_CANVAS : DARK_CANVAS;
        final int textColor = light ? LIGHT_TEXT : DARK_TEXT;
        final int brand = light ? LIGHT_BRAND : DARK_BRAND;

        root.setBackgroundColor(canvas);
        loadingLayer.setBackgroundColor(canvas);
        errorLayer.setBackgroundColor(canvas);
        tipView.setTextColor(textColor);
        errorText.setTextColor(textColor);
        spinner.getIndeterminateDrawable().setTint(brand);
        // 按钮底色/字色按产品规范：深色主题 品牌蓝 + 黑字，浅色主题 深蓝 + 白字
        retryButton.setBackgroundTintList(ColorStateList.valueOf(brand));
        retryButton.setTextColor(light ? 0xFFFFFFFF : 0xFF000000);
        if (webView != null) webView.setBackgroundColor(canvas);
        getWindow().setBackgroundDrawable(new ColorDrawable(canvas));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+：系统栏透明，底色由上面的 window background 透出来
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        } else {
            // Android 10 及以下：老机型不支持透明系统栏，直接涂成同一底色
            WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
            getWindow().setStatusBarColor(canvas);
            getWindow().setNavigationBarColor(canvas);
        }
        // 状态栏/导航栏图标明暗跟随主题：深色底用亮图标，浅色底用暗图标
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), root);
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }

    // ───────────────────────── WebView ─────────────────────────

    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        // localStorage / IndexedDB（Dexie）全靠它，千万别关
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // 关掉会让 <input type=file> 选到的 content:// 读不出来
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // 打上 App 身份标记（见 APP_UA_TOKEN 注释）。用系统 UA 追加而不是整串写死，
        // 这样原生组件/服务端按 UA 做的兼容判断不会因为我们改写而失效。
        String ua = s.getUserAgentString();
        if (ua != null && !ua.contains(APP_UA_TOKEN)) {
            s.setUserAgentString(ua + " " + APP_UA_TOKEN);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false); // 局域网/CN 网络下误判率高，误伤主站
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                showLoading();
                injectExportHook();
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                // 首帧已可绘制：撤掉加载态（比 onPageFinished 更早，SPA 上差别明显）
                hideOverlays();
                // onPageStarted 时新文档还没建立 JS 上下文，注入可能落在旧文档上，
                // 所以这里（以及 onPageFinished）必须再注入一次——重复注入由 __iiHooked 挡住。
                injectExportHook();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideOverlays();
                injectExportHook();
            }

            // API 23+ 主文档错误
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    showError(describe(error));
                }
            }

            // API 21/22 主文档错误（上面的重载在这两个版本不会被调用）
            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int code, String desc, String failingUrl) {
                showError(desc + " (" + code + ")");
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request != null && request.isForMainFrame() && response != null) {
                    showError("服务器返回 " + response.getStatusCode() + " " + response.getReasonPhrase());
                }
            }

            // 证书错误一律不继续，绝不调用 handler.proceed()
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                showError("HTTPS 证书校验失败");
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && host.equals(u.getHost())) return false; // 主站站内跳转，留在 WebView
                openExternally(u);
                return true;
            }

            // 渲染进程被杀（低内存）后 WebView 会永久空白，必须自行接管。
            // 注意：这种情况下这个 WebView 实例已经废了，必须丢弃，重试时重建。
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                rendererGone = true;
                if (webView != null) {
                    webView.removeJavascriptInterface("AndroidDownload");
                    webView.removeJavascriptInterface("AndroidShell");
                    webView.destroy();
                    webView = null;
                }
                showError("页面进程被系统回收，请重新加载");
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            // 不开启 setSupportMultipleWindows：开启后 target="_blank" 会走
            // onCreateWindow，而 WebView.WebViewTransport 是带 this$0 的内部类
            // （非 static），resultMsg 那个历史遗留的 Bitmap 参数无法强转过去。
            // 保持默认（关闭）时 target="_blank" 直接在当前 WebView 打开，
            // 上面的 shouldOverrideUrlLoading 已经能正确区分站内/站外。
            //
            // 导入用的 <input type="file">：不实现则点了没反应
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    toast("未找到可用的文件选择器");
                    return false;
                }
            }
            // 不覆写 onPermissionRequest：壳里没有声明 CAMERA / RECORD_AUDIO，
            // 「无条件 grant」等于给任意页面开摄像头麦克风。网页侧的
            // primeMediaPermission() 本来就会静默降级（面对面传输走云端兜底）。
        });

        // 导出（CSV/Excel）是 blob: URL，http(s) 的下载交给 DownloadManager
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                if (url != null && (url.startsWith("blob:") || url.startsWith("data:"))) {
                    // 正常路径是网页直连 AndroidDownload.save（见 src/utils/androidShell.ts），
                    // 走到这里说明兜底钩子也没接住，明确告诉用户而不是假装在准备文件
                    toast("导出未开始，请稍后重试或改用浏览器打开");
                    return;
                }
                try {
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setMimeType(mimetype);
                    req.addRequestHeader("User-Agent", userAgent);
                    req.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setTitle(fileNameOf(contentDisposition, url));
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                            fileNameOf(contentDisposition, url));
                    dm.enqueue(req);
                } catch (Exception e) {
                    openExternally(Uri.parse(url));
                }
            }
        });

        webView.addJavascriptInterface(new DownloadBridge(), "AndroidDownload");
        webView.addJavascriptInterface(new ShellBridge(), "AndroidShell");
    }

    /**
     * 兜底：拦截 &lt;a download href="blob:|data:"&gt;。
     *
     * 网页侧 `downloadBlob()` 已经会优先直连 AndroidDownload.save，这里的钩子只负责
     * 「有人自己造了个 a 标签」的情况（历史代码路径 / 以后新增的导出）。
     * 三个时机各注入一次（onPageStarted / onPageCommitVisible / onPageFinished），
     * 因为 onPageStarted 执行时新文档的 JS 上下文可能还没建立；__iiHooked 保证只挂一次。
     */
    private void injectExportHook() {
        if (webView == null) return;
        final String js =
            "(function(){"
          + "if(window.__iiHooked){return;}window.__iiHooked=true;"
          + "function pull(href,name){"
          + "fetch(href).then(function(r){return r.blob();})"
          + ".then(function(b){return b.arrayBuffer();})"
          + ".then(function(buf){"
          + "var u=new Uint8Array(buf),bin='',CH=0x8000;"
          + "for(var i=0;i<u.length;i+=CH){"
          + "bin+=String.fromCharCode.apply(null,u.subarray(i,i+CH));}"
          + "if(window.AndroidDownload){window.AndroidDownload.save(name,btoa(bin));}"
          + "}).catch(function(){alert('导出失败，请重试');});"
          + "}"
          + "document.addEventListener('click',function(e){"
          + "var t=e.target;var a=(t&&t.closest)?t.closest('a[download]'):null;"
          + "if(!a){return;}"
          + "var href=a.getAttribute('href')||'';"
          + "if(href.indexOf('blob:')!==0&&href.indexOf('data:')!==0){return;}"
          + "e.preventDefault();"
          + "pull(href,a.getAttribute('download')||'export');"
          + "},true);})();";
        webView.evaluateJavascript(js, null);
    }

    // ───────────────────────── 返回键 ─────────────────────────

    /**
     * 预测性返回（Android 13+ 的 OnBackInvokedCallback 路径）：
     * targetSdk 36 在 Android 16 上 onBackPressed() 不再被调用，
     * 所以统一用 OnBackPressedDispatcher 注册——它在 API 33+ 自动改走 OnBackInvokedCallback，
     * 低版本仍走 onBackPressed，行为一致。
     *
     * 「返回 = 关掉眼前那层」的真正实现仍在网页里（src/utils/backButton.ts 压历史条目、
     * 监听 popstate）；这里只负责把系统返回键翻译成 WebView 的后退，让 popstate 有机会触发。
     */
    private void configureBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (rendererGone || webView == null) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    // 没有可退的历史：交回系统（回桌面/上一个应用）
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    // ───────────────────────── 状态切换 ─────────────────────────

    private void showLoading() {
        loadingLayer.setVisibility(View.VISIBLE);
        errorLayer.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.VISIBLE);
    }

    private void hideOverlays() {
        loadingLayer.setVisibility(View.GONE);
        errorLayer.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.VISIBLE);
    }

    private void showError(String detail) {
        if (loadingLayer == null || errorLayer == null) return;
        loadingLayer.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.INVISIBLE);
        errorText.setText("网络连接失败，请检查网络后重试\n\n" + (detail == null ? "" : detail));
        errorLayer.setVisibility(View.VISIBLE);
    }

    /** 重试入口：WebView 还活着就重载，被系统回收过就整体重建 Activity。 */
    private void restart() {
        if (webView == null || rendererGone) {
            recreate();
            return;
        }
        showLoading();
        webView.loadUrl(launchUrl);
    }

    private static String describe(WebResourceError e) {
        if (e == null) return "";
        CharSequence d = e.getDescription();
        return d == null ? ("code " + e.getErrorCode()) : d.toString();
    }

    private void openExternally(Uri u) {
        if (u == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignored) {
            toast("无法打开该链接");
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    private static String fileNameOf(String disposition, String url) {
        String name = "download";
        if (disposition != null) {
            int i = disposition.indexOf("filename=");
            if (i >= 0) {
                name = disposition.substring(i + 9).replace("\"", "").trim();
            }
        }
        name = name.replaceAll("[/\\\\:*?\"<>|]", "_");
        return name.isEmpty() ? "download" : name;
    }

    // ───────────────────────── 文件选择 ─────────────────────────

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        result = new Uri[n];
                        for (int i = 0; i < n; i++) {
                            result[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        result = new Uri[]{data.getData()};
                    }
                }
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ───────────────────────── 导出落盘 ─────────────────────────

    /**
     * 把 blob: 导出的内容落到系统「下载」目录。
     * 仅主站页面会被放行：站外链接一律交给系统浏览器，接口不暴露给第三方页面。
     */
    private class DownloadBridge {
        @JavascriptInterface
        public void save(String name, String b64) {
            final String safeName = fileNameOf("filename=" + name, "");
            final byte[] bytes;
            try {
                bytes = Base64.decode(b64, Base64.DEFAULT);
            } catch (Exception e) {
                toast("保存失败：数据解码出错");
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    saveToDownloads(safeName, bytes);
                }
            });
        }
    }

    /** 网页 → 原生：主题同步 + 版本探测（网页据此判断有没有桥）。 */
    private class ShellBridge {
        @JavascriptInterface
        public void setTheme(String mode) {
            final String next = "light".equals(mode) ? "light" : "dark";
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (next.equals(theme)) return;
                    prefs().edit().putString(KEY_THEME, next).apply();
                    applyTheme(next);
                }
            });
        }
    }

    /**
     * Android 6–9（API 23–28）写公共「下载」目录需要运行时写权限；
     * Android 10+ 走 MediaStore 不需要。缺权限时先申请，授权后把内容补写出去；
     * 用户拒绝就退回到应用私有目录（不需要任何权限），并如实告知路径。
     */
    private void saveToDownloads(String name, byte[] bytes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
            pendingName = name;
            pendingBytes = bytes;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_WRITE);
            return;
        }
        writeAsync(name, bytes, false);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_WRITE) return;
        String name = pendingName;
        byte[] bytes = pendingBytes;
        pendingName = null;
        pendingBytes = null;
        if (name == null || bytes == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (!granted) toast("没有存储权限，改为保存到应用私有目录");
        writeAsync(name, bytes, !granted);
    }

    private void writeAsync(final String name, final byte[] bytes, final boolean toPrivateDir) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    final String shownPath = toPrivateDir
                            ? writeToPrivateDir(name, bytes)
                            : writeToDownloads(name, bytes);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "已保存到 " + shownPath, Toast.LENGTH_LONG).show();
                        }
                    });
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "保存失败：" + e.getMessage(),
                                    Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }

    private String writeToDownloads(String name, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
            cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (item == null) throw new IllegalStateException("无法在下载目录创建文件");
            OutputStream os = getContentResolver().openOutputStream(item);
            if (os == null) throw new IllegalStateException("无法写入下载目录");
            try {
                os.write(bytes);
            } finally {
                os.close();
            }
            return "「下载」/" + name;
        }
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("无法创建下载目录");
        File out = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            fos.write(bytes);
        } finally {
            fos.close();
        }
        return "「下载」/" + name;
    }

    private String writeToPrivateDir(String name, byte[] bytes) throws Exception {
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) throw new IllegalStateException("无法访问存储");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("无法创建目录");
        File out = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            fos.write(bytes);
        } finally {
            fos.close();
        }
        return out.getAbsolutePath();
    }

    // ───────────────────────── 生命周期 ─────────────────────────

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        pendingName = null;
        pendingBytes = null;
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidDownload");
            webView.removeJavascriptInterface("AndroidShell");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
