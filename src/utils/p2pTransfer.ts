// 面对面互传（WebRTC 点对点）
//
// 设计要点：
// - 纯浏览器 RTCPeerConnection，无任何第三方服务器；两台设备通过「扫二维码 / 粘贴码」
//   手动交换信令（offer/answer），随后数据经 RTCDataChannel 直接互传，全程不经过服务器。
// - 同一局域网下使用主机候选（host candidate）即可连通，故 iceServers 留空——
//   不依赖可能被墙的 STUN/TURN（中国网络一等公民）。
// - 信令编码、分块协议均为纯函数，便于单元测试；WebRTC 会话逻辑依赖浏览器 API。

// ——————————————————————————————
// 纯函数：base64（UTF-8 安全）
// ——————————————————————————————
export function b64EncodeUtf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}
export function b64DecodeUtf8(s: string): string {
  return decodeURIComponent(escape(atob(s)))
}

// ——————————————————————————————
// 纯函数：信令（offer/answer）编码 / 解码
// 码格式：IIF2P1. + base64(JSON{type,sdp})。前缀用于和其它二维码（如同步码）区分。
// ——————————————————————————————
export const SIGNAL_PREFIX = 'IIF2P1.'

export interface SignalPayload {
  type: 'offer' | 'answer'
  sdp: string
}

export function encodeSignal(desc: { type?: RTCSdpType | string; sdp?: string | null }): string {
  const payload: SignalPayload = { type: (desc.type ?? 'offer') as 'offer' | 'answer', sdp: desc.sdp ?? '' }
  return SIGNAL_PREFIX + b64EncodeUtf8(JSON.stringify(payload))
}

export function decodeSignal(code: string): SignalPayload | null {
  const trimmed = String(code ?? '').trim()
  if (!trimmed.startsWith(SIGNAL_PREFIX)) return null
  try {
    const obj = JSON.parse(b64DecodeUtf8(trimmed.slice(SIGNAL_PREFIX.length))) as SignalPayload
    if (obj && (obj.type === 'offer' || obj.type === 'answer') && typeof obj.sdp === 'string' && obj.sdp.length > 0) {
      return obj
    }
    return null
  } catch {
    return null
  }
}

// ——————————————————————————————
// 纯函数：分块传输协议
// 一条完整数据被拆成 meta + N 个 chunk + end，逐条以 JSON 字符串经数据通道发送。
// ——————————————————————————————
export const CHUNK_SIZE = 16 * 1024

/**
 * 单次互传的分块数上限。
 *
 * `expected` 直接取自对端发来的 meta.chunks，没有任何上限，
 * 于是 `new Array(expected)` 遇到一个恶意/损坏的数值就能把标签页打崩。
 * 按 CHUNK_SIZE 16KB 算，这个上限对应约 256MB 负载 ——
 * 对「导出全部数据做面对面互传」这个场景绰绰有余。
 */
const MAX_CHUNKS = 16_384

export interface WireMeta { t: 'meta'; accountId: string; username: string; chunks: number; bytes: number }
export interface WireChunk { t: 'chunk'; i: number; data: string }
export interface WireEnd { t: 'end' }
export type WireMsg = WireMeta | WireChunk | WireEnd

export interface SendMeta { accountId: string; username: string }

/** 把完整负载拆成待发送的 JSON 消息序列：[meta, ...chunks, end] */
export function buildSendSequence(payload: string, meta: SendMeta): string[] {
  const chunks: string[] = []
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    chunks.push(payload.slice(i, i + CHUNK_SIZE))
  }
  const msgs: string[] = []
  const head: WireMeta = { t: 'meta', accountId: meta.accountId, username: meta.username, chunks: chunks.length, bytes: payload.length }
  msgs.push(JSON.stringify(head))
  chunks.forEach((data, i) => {
    const c: WireChunk = { t: 'chunk', i, data }
    msgs.push(JSON.stringify(c))
  })
  const end: WireEnd = { t: 'end' }
  msgs.push(JSON.stringify(end))
  return msgs
}

/**
 * 接收端重组器：逐条喂入收到的原始字符串，收齐（收到 end）后返回完整负载，
 * 期间返回 null。同时记录 meta（含对端账号/用户名）与接收进度。
 */
export class ChunkReceiver {
  private chunks: string[] = []
  /** 读出来仅为测试断言（分块数在合法负载下等于 meta.chunks） */
  expected = 0
  received = 0
  meta: WireMeta | null = null
  done = false
  /** 收到 end 但仍有缺块时的缺失序号，供重发与超时判定使用 */
  missing: number[] = []
  /** meta 的 chunks 数非法或超限：拒绝本次负载 */
  invalid = false

  /** 喂入一条原始消息；若由此凑齐完整负载则返回它，否则返回 null */
  feed(raw: string): string | null {
    if (this.done) return null
    let msg: WireMsg
    try {
      msg = JSON.parse(raw) as WireMsg
    } catch {
      return null
    }
    if (!msg || typeof msg !== 'object') return null

    if (msg.t === 'meta') {
      // 先校验再分配。`msg.chunks | 0` 对 NaN/undefined/负数/小数都会得到
      // 一个「看起来合法」的值（NaN→0），而 0 分块会让 feed() 在收到 end 时
      // 返回空字符串而不是 null —— 把「元数据损坏」降级成了「合法的空负载」，
      // 用户看到的是 BAD_PAYLOAD，而真实原因是负载信息不可信。
      // 必须要求原始类型就是 number：JSON.stringify({chunks: NaN}) 得到的是
      // null，而 Number(null) === 0 —— 那样 NaN 会被当成合法的「0 分块」，
      // 于是损坏的负载被降级成空负载，上层 JSON.parse('') 报出一个误导性的错。
      const chunks = (msg as unknown as Record<string, unknown>).chunks
      if (typeof chunks !== 'number' || !Number.isInteger(chunks) || chunks < 0) {
        this.invalid = true
        return null
      }
      const n = chunks
      if (n > MAX_CHUNKS) {
        this.invalid = true
        return null
      }
      this.meta = msg
      this.expected = n
      this.chunks = new Array<string>(n).fill('')
      this.received = 0
      this.invalid = false
      // 0 分块（空负载）时，meta 之后收到 end 即完成
      return null
    }
    if (msg.t === 'chunk') {
      if (!Number.isInteger(msg.i)) return null
      if (msg.i >= 0 && msg.i < this.expected && this.chunks[msg.i] === '') {
        this.chunks[msg.i] = msg.data
        this.received++
      }
      return null
    }
    if (msg.t === 'end') {
      if (this.invalid || this.meta == null) return null // 负载信息不可信：拒绝返回
      // 防御：可靠有序通道下不应缺块。缺块时**不**置 done ——
      // 原来这里是 `this.done = true` 然后再 return null，而 feed() 开头
      // 就是 `if (this.done) return null`。于是任何一次缺块/乱序都会让接收器
      // 进入永久 done 状态：后续消息全被丢弃、onReceivedPayload 永不触发、
      // 也没有任何超时兜底。界面上就是两条永远不动的进度条，不报错也不结束，
      // 用户只能手动关窗。注释说的「宁可挂起」变成了「永久挂起」。
      //
      // 现在缺块只记 missing（供对端重发和超时判定使用），保持可继续接收。
      if (this.received < this.expected) {
        this.missing = []
        for (let i = 0; i < this.expected; i++) if (!this.chunks[i]) this.missing.push(i)
        return null
      }
      this.done = true
      return this.chunks.join('')
    }
    return null
  }

  /** 接收进度 0..1（按分块计） */
  get progress(): number {
    if (this.expected <= 0) return this.done ? 1 : 0
    return Math.min(1, this.received / this.expected)
  }
}

// ——————————————————————————————
// WebRTC 会话（依赖浏览器 RTCPeerConnection）
// ——————————————————————————————

// 同局域网用主机候选即可，留空 iceServers 避免依赖境外 STUN/TURN
const RTC_CONFIG: RTCConfiguration = { iceServers: [] }
// ICE 收集兜底超时（主机候选通常很快）
// mDNS 注册可能比较慢，3 秒容易在拿到可用候选前就放弃；放宽到 8 秒，
// 但一旦已经收到真实 IP 的 host 候选就立即结束等待（不必再等 srflx/relay）
const ICE_GATHER_TIMEOUT_MS = 8000

/**
 * 把「连不上」翻译成用户能采取行动的具体原因。
 *
 * 原来是所有情况都报同一句「连接失败，确认同一个 Wi-Fi」，
 * 但真实原因至少有三类，处理方式完全不同：
 *  1) 一个候选都没有 → 设备根本没拿到网络地址，或所在网络禁止 P2P
 *  2) 只有 mDNS 候选 → 浏览器隐藏了内网地址，授权麦克风即可解决
 *  3) 有真实 IP 仍失败 → 路由器把两台设备隔开了
 */
export function classifyConnectFailure(d: IceDiagnostics): P2PErrorCode {
  if (d.realHost === 0 && d.mdnsHost === 0 && d.other === 0) return 'NO_CANDIDATE'
  if (d.realHost === 0) return 'MDNS_ONLY'
  return 'ISOLATED'
}

/** 本端收集到的 ICE 候选分类，用于失败时给出可行动的诊断 */
export interface IceDiagnostics {
  /** 真实 IP 的 host 候选（最好的情况，同网段直连） */
  realHost: number
  /** mDNS 混淆候选（形如 xxxx-xxxx.local），对端解析不了就连不上 */
  mdnsHost: number
  /** srflx / relay 候选 */
  other: number
  /** 收集过程中的报错（多为 mDNS 注册失败，此时候选会被直接丢弃） */
  gatherErrors: string[]
}

function emptyDiag(): IceDiagnostics {
  return { realHost: 0, mdnsHost: 0, other: 0, gatherErrors: [] }
}

function isMdnsCandidate(c: RTCIceCandidate): boolean {
  const a = c.address ?? ''
  return a.endsWith('.local') || a.endsWith('.local.')
}

/**
 * 预热媒体权限。
 *
 * 这是本功能能不能用的关键：浏览器在「没有录音/摄像头权限」时，
 * 会把 WebRTC 的本机地址替换成 mDNS 名字（.local）来保护隐私，
 * 两台同网段的设备因此经常连不上 —— Chromium 上尤其明显，
 * Safari/iOS 在未授权时更是只有 mDNS 候选。
 * 一旦授权过，ICE 收集到的就是**真实内网 IP**，直连立刻变稳。
 *
 * 所以这里主动申请一次麦克风权限（拿到的流立刻停掉，不录制任何声音）。
 * 用户拒绝或设备没有麦克风时静默降级，不阻断流程。
 */
export async function primeMediaPermission(): Promise<boolean> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!md?.getUserMedia) return false
  // 已经是 granted 就不用再弹窗
  try {
    if (navigator.permissions?.query) {
      const st = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (st.state === 'granted') return true
    }
  } catch {
    /* 部分浏览器不支持查询麦克风权限，忽略 */
  }
  try {
    const stream = await md.getUserMedia({ audio: true, video: false })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}
// 发送尾部等待缓冲清空的兜底上限，避免异常情况下无限轮询
const FLUSH_TIMEOUT_MS = 30000
/**
 * 传输停滞看门狗：传输开始后，若 STALL_TIMEOUT 内 sent/recv 都没有推进，
 * 就判定失败并报错。
 *
 * 为什么需要它：`onconnectionstatechange` 只认 failed / closed
 * （'disconnected' 被有意当成可恢复的中间态）。但「disconnected 之后
 * 再也没有恢复、也永远不 failed」在移动端切网/锁屏时是会发生的，
 * 此时既不报错也不结束 —— 界面上是两条永远不动的进度条，
 * 用户能做的只有手动关窗。分块缺块/乱序现在也能恢复接收，
 * 但对端干脆不再发数据时仍然没有兜底。
 */
const STALL_TIMEOUT_MS = 45_000

export interface SessionMeta { accountId: string; username: string }

export interface P2PProgress {
  /** 本端发送进度 0..1 */
  sent: number
  /** 接收对端进度 0..1 */
  recv: number
}

export interface P2PSessionCallbacks {
  /** 与对端建立连接并确认账号一致后触发（携带对端用户名） */
  onConnected?: (peerUsername: string) => void
  onProgress?: (p: P2PProgress) => void
  /** 完整收到对端负载（JSON 字符串）时触发 */
  onReceivedPayload?: (payload: string) => void
  /** 本端负载已全部发出（缓冲清空）时触发 */
  onSentComplete?: () => void
  onError?: (err: Error) => void
}

export type P2PErrorCode =
  | 'BAD_SIGNAL'
  | 'ACCOUNT_MISMATCH'
  | 'CONNECT_FAILED'
  | 'SEND_FAILED'
  | 'STALLED'
  | 'NO_WEBRTC'
  | 'READ_ONLY'
  // —— 新增：把「连不上」拆成可行动的具体原因 ——
  /** 一个可用候选都没收集到（SDP 是空的，100% 连不上） */
  | 'NO_CANDIDATE'
  /** 只收集到 mDNS 混淆候选（.local），对端解析不了 */
  | 'MDNS_ONLY'
  /** 有真实 IP 候选但仍然连不上 → 基本可判定是路由器做了设备隔离 */
  | 'ISOLATED'

export class P2PError extends Error {
  code: P2PErrorCode
  constructor(code: P2PErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

function waitIceComplete(pc: RTCPeerConnection, diag: IceDiagnostics): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const onState = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    const finish = () => {
      if (settled) return
      settled = true
      if (timer != null) clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', onState)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', onState)
    // 已经拿到真实内网 IP 的 host 候选就没必要再等了（我们不配 STUN/TURN，
    // 后续只会收集到用不上的 srflx/relay），早结束可以让用户少等几秒
    if (diag.realHost > 0) {
      const t = setInterval(() => {
        if (diag.realHost > 0 || pc.iceGatheringState === 'complete') {
          clearInterval(t)
          finish()
        }
      }, 120)
    }
    timer = setTimeout(finish, ICE_GATHER_TIMEOUT_MS)
  })
}

// 等待数据通道缓冲回落；通道关闭/会话结束时也要立即返回，避免发送循环永久挂起
function waitForLowBuffer(ch: RTCDataChannel): Promise<void> {
  return new Promise<void>((resolve) => {
    if (ch.readyState !== 'open') return resolve()
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      ch.onbufferedamountlow = null
      ch.removeEventListener('close', onClose)
      resolve()
    }
    const onClose = () => settle()
    ch.onbufferedamountlow = settle
    ch.addEventListener('close', onClose)
  })
}

/**
 * 单条点对点会话。发起方先 createOffer 得到二维码/码，加入方 acceptOffer 后
 * createAnswer 回给发起方，发起方 acceptAnswer 后双方连通并自动互传数据。
 */
export class P2PSession {
  private pc: RTCPeerConnection
  private channel: RTCDataChannel | null = null
  private receiver = new ChunkReceiver()
  private sendMsgs: string[] = []
  private sentIndex = 0
  private stallTimer: ReturnType<typeof setTimeout> | null = null
  private lastStallSent = -1
  private lastStallRecv = -1
  private cb: P2PSessionCallbacks
  private selfMeta: SessionMeta
  private ended = false
  private diag: IceDiagnostics = emptyDiag()

  private diagnoseConnectFailure(): P2PErrorCode {
    return classifyConnectFailure(this.diag)
  }

  /** 供调用方展示诊断信息（连接失败时给用户看） */
  getDiagnostics(): IceDiagnostics {
    return { ...this.diag, gatherErrors: [...this.diag.gatherErrors] }
  }

  constructor(cb: P2PSessionCallbacks, selfMeta: SessionMeta) {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new P2PError('NO_WEBRTC')
    }
    this.cb = cb
    this.selfMeta = selfMeta
    this.pc = new RTCPeerConnection(RTC_CONFIG)

    // 候选收集诊断：mDNS 注册失败时浏览器会直接丢弃该候选（IETF
    // draft-ietf-rtcweb-mdns-ice-candidates 明确规定），这会让 SDP 里
    // 一个可用候选都没有 —— 必须把它记下来才能解释失败原因。
    this.pc.onicecandidateerror = (ev) => {
      // 注意：这里不读 ev.error 的具体文案，避免在日志里泄露地址
      // errorCode 是数字枚举，统一转成字符串存
      const code = (ev as RTCPeerConnectionIceErrorEvent).errorCode
      this.diag.gatherErrors.push(code == null ? 'unknown' : String(code))
    }
    this.pc.onicecandidate = (ev) => {
      const c = ev.candidate
      if (!c) return // null 表示收集结束
      if (c.type === 'host') {
        if (isMdnsCandidate(c)) this.diag.mdnsHost++
        else this.diag.realHost++
      } else {
        this.diag.other++
      }
    }
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState
      // 'disconnected' 是可恢复的中间态（ICE 可能自己重连），
      // 当成硬失败会导致大量误报。只认 failed / closed。
      if ((st === 'failed' || st === 'closed') && !this.ended) {
        this.fail(new P2PError(this.diagnoseConnectFailure()))
      }
    }
    // 加入方通过此回调接收发起方创建的数据通道
    this.pc.ondatachannel = (ev) => {
      this.bindChannel(ev.channel)
    }
  }

  // —— 发起方 ——
  async createOffer(payload: string): Promise<string> {
    this.sendMsgs = buildSendSequence(payload, this.selfMeta)
    const ch = this.pc.createDataChannel('f2f', { ordered: true })
    this.bindChannel(ch)
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    await waitIceComplete(this.pc, this.diag)
    // 收集不到任何候选时立刻失败并说清原因，
    // 否则用户会拿到一段完全没用的配对码，白白复制粘贴两遍
    if (this.diag.realHost === 0 && this.diag.mdnsHost === 0 && this.diag.other === 0) {
      throw new P2PError('NO_CANDIDATE')
    }
    return encodeSignal(this.pc.localDescription ?? { type: 'offer', sdp: '' })
  }

  async acceptAnswer(code: string): Promise<void> {
    const desc = decodeSignal(code)
    if (!desc || desc.type !== 'answer') throw new P2PError('BAD_SIGNAL')
    await this.pc.setRemoteDescription({ type: 'answer', sdp: desc.sdp })
  }

  // —— 加入方 ——
  async acceptOffer(code: string): Promise<void> {
    const desc = decodeSignal(code)
    if (!desc || desc.type !== 'offer') throw new P2PError('BAD_SIGNAL')
    await this.pc.setRemoteDescription({ type: 'offer', sdp: desc.sdp })
  }

  async createAnswer(payload: string): Promise<string> {
    this.sendMsgs = buildSendSequence(payload, this.selfMeta)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    await waitIceComplete(this.pc, this.diag)
    if (this.diag.realHost === 0 && this.diag.mdnsHost === 0 && this.diag.other === 0) {
      throw new P2PError('NO_CANDIDATE')
    }
    return encodeSignal(this.pc.localDescription ?? { type: 'answer', sdp: '' })
  }

  /** 主动结束并释放资源（关闭弹窗/出错时调用） */
  close(): void {
    this.ended = true
    this.clearStallWatchdog()
    try { this.channel?.close() } catch { /* ignore */ }
    try { this.pc.close() } catch { /* ignore */ }
  }

  private bindChannel(ch: RTCDataChannel): void {
    this.channel = ch
    ch.onopen = () => { void this.sendAll() }
    ch.onmessage = (ev) => this.handleMessage(ev)
  }

  private handleMessage(ev: MessageEvent): void {
    const raw = typeof ev.data === 'string' ? ev.data : ''
    if (!raw || this.ended) return

    // 账号一致性校验：meta 到达即比对，不一致立即终止，避免跨账号误合并
    try {
      const m = JSON.parse(raw) as Partial<WireMeta>
      if (m && m.t === 'meta') {
        if (m.accountId !== this.selfMeta.accountId) {
          this.fail(new P2PError('ACCOUNT_MISMATCH'))
          return
        }
        this.cb.onConnected?.(String(m.username ?? ''))
      }
    } catch { /* 非 JSON，忽略 */ }

    const assembled = this.receiver.feed(raw)
    this.emitProgress()
    if (assembled != null) {
      this.cb.onReceivedPayload?.(assembled)
    }
  }

  private async sendAll(): Promise<void> {
    const ch = this.channel
    if (!ch) return
    ch.bufferedAmountLowThreshold = CHUNK_SIZE * 8
    try {
      for (let i = 0; i < this.sendMsgs.length; i++) {
        // 背压控制：缓冲过高时等待排空；通道关闭会立即返回，不会永久挂起
        while (
          ch.bufferedAmount > ch.bufferedAmountLowThreshold &&
          !this.ended &&
          ch.readyState === 'open'
        ) {
          await waitForLowBuffer(ch)
        }
        if (this.ended || ch.readyState !== 'open') break
        ch.send(this.sendMsgs[i])
        this.sentIndex = i + 1
        this.emitProgress()
      }
      // 等待缓冲彻底清空，确保对端可靠收齐（数据通道为可靠传输）；带兜底上限
      const flushDeadline = Date.now() + FLUSH_TIMEOUT_MS
      while (
        ch.bufferedAmount > 0 &&
        !this.ended &&
        ch.readyState === 'open' &&
        Date.now() < flushDeadline
      ) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (this.ended) return
      if (ch.readyState !== 'open') {
        // 原来这里是静默 return：既不 onSentComplete 也不 onError。
        // 通道中途 disconnected（移动端切网/锁屏最常见的路径）时，
        // sentDone 永远为 false → 弹窗永远停在「传输中」，
        // fail() 也永不触发。用户只能手动关窗。
        this.fail(new P2PError('SEND_FAILED'))
        return
      }
      this.emitProgress()
      this.cb.onSentComplete?.()
    } catch (e) {
      this.fail(e instanceof P2PError ? e : new P2PError('SEND_FAILED'))
    }
  }

  private emitProgress(): void {
    const sent = this.sendMsgs.length > 0 ? this.sentIndex / this.sendMsgs.length : 0
    this.cb.onProgress?.({ sent: Math.min(1, sent), recv: this.receiver.progress })
    this.armStallWatchdog(sent, this.receiver.progress)
  }

  /** 每次有推进就重新计时；只有进度真的变了才算「活着」 */
  private armStallWatchdog(sent: number, recv: number): void {
    if (this.ended) return
    if (sent === this.lastStallSent && recv === this.lastStallRecv) return
    this.lastStallSent = sent
    this.lastStallRecv = recv
    if (this.stallTimer) clearTimeout(this.stallTimer)
    this.stallTimer = setTimeout(() => {
      if (this.ended) return
      this.fail(new P2PError('STALLED'))
    }, STALL_TIMEOUT_MS)
  }

  private clearStallWatchdog(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
  }

  private fail(err: P2PError): void {
    if (this.ended) return
    this.ended = true
    this.clearStallWatchdog()
    this.close()
    this.cb.onError?.(err)
  }
}
