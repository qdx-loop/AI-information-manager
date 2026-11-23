#!/usr/bin/env bash
#
# 出正式包：gradle assembleRelease → zipalign → apksigner → 覆盖 public/app/infodesk.apk
#
# 用法：
#   cd apk-build
#   KEYSTORE_PASS='<keystore 密码>' ./build-release.sh
#
# 密码不走命令行参数（会进 shell 历史与 ps），只从环境变量读。
# 发布前记得把 app/build.gradle 的 versionCode 加一，否则已安装用户装不上（Android 拒绝降级/同版本覆盖）。
set -euo pipefail

cd "$(dirname "$0")"

: "${KEYSTORE_PASS:?请用 KEYSTORE_PASS='<keystore 密码>' ./build-release.sh 运行}"
KEYSTORE=infodesk.keystore
ALIAS=infodesk
JAVA_HOME_DEFAULT="$HOME/.bubblewrap/jdk"
SDK="${ANDROID_SDK_ROOT:-$HOME/.bubblewrap/android-sdk}"
# 别用系统的 Java 25：Gradle 8.11.1 跑不起来，bubblewrap 自带的是 JDK 17
export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"

BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
[ -n "$BT" ] || { echo "找不到 build-tools，检查 SDK 路径：$SDK" >&2; exit 1; }

echo "==> gradle assembleRelease（JAVA_HOME=$JAVA_HOME）"
./gradlew --no-daemon assembleRelease

UNSIGNED=app/build/outputs/apk/release/app-release-unsigned.apk
ALIGNED=app/build/outputs/apk/release/app-release-aligned.apk
SIGNED=app-release-signed.apk

echo "==> zipalign"
"$BT/zipalign" -p -f 4 "$UNSIGNED" "$ALIGNED"

echo "==> apksigner sign"
"$BT/apksigner" sign \
  --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$KEYSTORE_PASS" --key-pass "pass:$KEYSTORE_PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$SIGNED" "$ALIGNED"

echo "==> 校验签名"
"$BT/apksigner" verify --print-certs "$SIGNED" | head -5

echo "==> 版本信息"
"$BT/aapt2" dump badging "$SIGNED" | grep -E "^package|targetSdkVersion"

echo "==> 覆盖站内下载入口 public/app/infodesk.apk"
cp "$SIGNED" ../public/app/infodesk.apk

cat <<'EOF'

完成。还需要做两件事：
  1. 确认 public/.well-known/assetlinks.json 里的 sha256_cert_fingerprints 与上面的证书指纹一致；
  2. 部署（npm run build && npx wrangler pages deploy dist --project-name info-manager），
     否则用户下的还是旧包。
EOF
