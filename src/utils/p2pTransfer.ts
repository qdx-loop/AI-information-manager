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
  private expected = 0
  private received = 0
  meta: WireMeta | null = null
  done = false

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
      this.meta = msg
      this.expected = Math.max(0, msg.chunks | 0)
      this.chunks = new Array<string>(this.expected).fill('')
      this.received = 0
      // 0 分块（空负载）时，meta 之后收到 end 即完成
      return null
    }
    if (msg.t === 'chunk') {
      if (msg.i >= 0 && msg.i < this.expected && this.chunks[msg.i] === '') {
        this.chunks[msg.i] = msg.data
        this.received++
      }
      return null
    }
    if (msg.t === 'end') {
      this.done = true
      // 防御：可靠有序通道下不应缺块；若缺块则拒绝返回损坏数据（宁可挂起也不静默错数据）
      if (this.received < this.expected) return null
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
const ICE_GATHER_TIMEOUT_MS = 3000
// 发送尾部等待缓冲清空的兜底上限，避免异常情况下无限轮询
const FLUSH_TIMEOUT_MS = 30000

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
  | 'NO_WEBRTC'
  | 'READ_ONLY'

export class P2PError extends Error {
  code: P2PErrorCode
  constructor(code: P2PErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
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
  private cb: P2PSessionCallbacks
  private selfMeta: SessionMeta
  private ended = false

  constructor(cb: P2PSessionCallbacks, selfMeta: SessionMeta) {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new P2PError('NO_WEBRTC')
    }
    this.cb = cb
    this.selfMeta = selfMeta
    this.pc = new RTCPeerConnection(RTC_CONFIG)

    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState
      if ((st === 'failed' || st === 'disconnected' || st === 'closed') && !this.ended) {
        this.fail(new P2PError('CONNECT_FAILED'))
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
    await waitIceComplete(this.pc)
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
    await waitIceComplete(this.pc)
    return encodeSignal(this.pc.localDescription ?? { type: 'answer', sdp: '' })
  }

  /** 主动结束并释放资源（关闭弹窗/出错时调用） */
  close(): void {
    this.ended = true
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
        if (this.ended || ch.readyState !== 'open') return
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
      if (this.ended || ch.readyState !== 'open') return
      this.emitProgress()
      this.cb.onSentComplete?.()
    } catch (e) {
      this.fail(e instanceof P2PError ? e : new P2PError('SEND_FAILED'))
    }
  }

  private emitProgress(): void {
    const sent = this.sendMsgs.length > 0 ? this.sentIndex / this.sendMsgs.length : 0
    this.cb.onProgress?.({ sent: Math.min(1, sent), recv: this.receiver.progress })
  }

  private fail(err: P2PError): void {
    if (this.ended) return
    this.ended = true
    this.close()
    this.cb.onError?.(err)
  }
}
