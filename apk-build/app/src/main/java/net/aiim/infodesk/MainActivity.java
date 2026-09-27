package net.aiim.infodesk;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 纯 WebView 主活动：加载主站，带加载态 + 出错重试，库内零依赖。
 *
 * 关键点（都是踩过的坑，改动前请先读 DEPLOY 记录）：
 *  1. AndroidManifest 必须显式声明 INTERNET 权限——本工程裁掉了 TWA 依赖后
 *     不再有清单合并替我们带入它，缺失时全部请求 net::ERR_ACCESS_DENIED，永久白屏。
 *  2. minSdk 21：onReceivedError 的 WebResourceRequest 重载是 API 23 才有的，
 *     必须同时实现 API 21/22 的旧重载，否则老机型永远停在「正在加载…」。
 *  3. 导出的 CSV/Excel 是 blob: URL，导入用 <input type=file>，两者在裸 WebView 里
 *     都静默失效，因此分别需要 JS 桥（save）与 onShowFileChooser。
 */
public class MainActivity extends Activity {

    private static final String LAUNCH_URL = "https://aiim.de5.net";
    private static final String HOST = "aiim.de5.net";
    private static final int REQ_FILE = 1001;

    private WebView webView;
    private View loadingLayer;
    private View errorLayer;
    private TextView errorText;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        // localStorage / IndexedDB（Dexie）全靠它，千万别关
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false); // 局域网/CN 网络下误判率高，误伤主站
        }
        webView.setBackgroundColor(Color.parseColor("#F0FDFA"));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                showLoading();
                injectBlobDownloadHook();
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                // 首帧已可绘制：撤掉加载态（比 onPageFinished 更早，SPA 上差别明显）
                hideOverlays();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                hideOverlays();
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
                if (u != null && HOST.equals(u.getHost())) return false; // 主站站内跳转，留在 WebView
                openExternally(u);
                return true;
            }

            // 渲染进程被杀（低内存）后 WebView 会永久空白，必须自行接管
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                webView = new WebView(MainActivity.this);
                webView.destroy();
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

            // 数据提醒依赖 Notification API，需要在壳里放行
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        // 导出（CSV/Excel）是 blob: URL，http(s) 的下载交给 DownloadManager
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                if (url != null && (url.startsWith("blob:") || url.startsWith("data:"))) {
                    toast("请稍候，正在准备文件…");
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

        // ---- 布局：WebView 全屏铺底，加载态/错误态覆盖在上面，避免内容跳动 ----
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F0FDFA"));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        loadingLayer = buildLoading();
        root.addView(loadingLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        errorLayer = buildError();
        root.addView(errorLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        webView.loadUrl(LAUNCH_URL);
    }

    /**
     * 拦截 &lt;a download href="blob:..."&gt;：这是应用导出 CSV/Excel 的唯一路径
     *（见 src/utils/csv.ts 的 downloadBlob）。裸 WebView 收到 blob: 下载只会静默丢弃，
     * 所以在页面加载时把 blob 转成 base64 交给 DownloadBridge 落盘。
     * http(s) 链接不拦截，交给原生 DownloadListener。
     */
    private void injectBlobDownloadHook() {
        final String js =
            "(function(){"
          + "if(window.__iiHooked){return;}window.__iiHooked=true;"
          + "document.addEventListener('click',function(e){"
          + "var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;"
          + "if(!a){return;}"
          + "var href=a.getAttribute('href')||'';"
          + "if(href.indexOf('blob:')!==0){return;}"
          + "e.preventDefault();"
          + "var name=a.getAttribute('download')||'export';"
          + "fetch(href).then(function(r){return r.blob();})"
          + ".then(function(b){return b.arrayBuffer();})"
          + ".then(function(buf){"
          + "var u=new Uint8Array(buf),bin='',CH=0x8000;"
          + "for(var i=0;i<u.length;i+=CH){"
          + "bin+=String.fromCharCode.apply(null,u.subarray(i,i+CH));}"
          + "if(window.AndroidDownload){window.AndroidDownload.save(name,btoa(bin));}"
          + "}).catch(function(){alert('导出失败，请重试');});"
          + "},true);})();";
        webView.evaluateJavascript(js, null);
    }

    private View buildLoading() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.parseColor("#F0FDFA"));
        ProgressBar bar = new ProgressBar(this);
        box.addView(bar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView tip = new TextView(this);
        tip.setText("正在加载…");
        tip.setTextColor(Color.parseColor("#475569"));
        tip.setTextSize(14);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = 16;
        box.addView(tip, tp);
        return box;
    }

    private View buildError() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        box.setBackgroundColor(Color.parseColor("#F0FDFA"));
        errorText = new TextView(this);
        errorText.setTextColor(Color.parseColor("#334155"));
        errorText.setTextSize(15);
        errorText.setGravity(Gravity.CENTER);
        box.addView(errorText, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        Button retry = new Button(this);
        retry.setText("重新加载");
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rp.topMargin = 24;
        box.addView(retry, rp);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showLoading();
                webView.loadUrl(LAUNCH_URL);
            }
        });
        box.setVisibility(View.GONE);
        return box;
    }

    private void showLoading() {
        loadingLayer.setVisibility(View.VISIBLE);
        errorLayer.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void hideOverlays() {
        loadingLayer.setVisibility(View.GONE);
        errorLayer.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showError(String detail) {
        if (loadingLayer == null || errorLayer == null) return;
        loadingLayer.setVisibility(View.GONE);
        webView.setVisibility(View.INVISIBLE);
        errorText.setText("网络连接失败，请检查网络后重试\n\n" + (detail == null ? "" : detail));
        errorLayer.setVisibility(View.VISIBLE);
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

    /**
     * 把 blob: 导出的内容落到系统「下载」目录。
     * 仅主站页面会被放行：站外链接一律交给系统浏览器，接口不暴露给第三方页面。
     */
    private class DownloadBridge {
        @JavascriptInterface
        public void save(String name, String b64) {
            final String safeName = fileNameOf("filename=" + name, "");
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                        writeToDownloads(safeName, bytes);
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(MainActivity.this,
                                        "已保存到「下载」/" + safeName, Toast.LENGTH_LONG).show();
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
    }

    private void writeToDownloads(String name, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
            cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            OutputStream os = getContentResolver().openOutputStream(item);
            try {
                os.write(bytes);
            } finally {
                if (os != null) os.close();
            }
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("无法创建下载目录");
            File out = new File(dir, name);
            FileOutputStream fos = new FileOutputStream(out);
            try {
                fos.write(bytes);
            } finally {
                fos.close();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidDownload");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
