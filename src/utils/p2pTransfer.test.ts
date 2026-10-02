// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  b64EncodeUtf8,
  b64DecodeUtf8,
  encodeSignal,
  decodeSignal,
  buildSendSequence,
  ChunkReceiver,
  CHUNK_SIZE,
  SIGNAL_PREFIX,
  classifyConnectFailure,
  type WireMeta,
} from '@/utils/p2pTransfer'

describe('base64 utf8 往返', () => {
  it('能往返编码含中文与 emoji 的字符串', () => {
    const s = '你好，世界 🚀 {"a":1}'
    expect(b64DecodeUtf8(b64EncodeUtf8(s))).toBe(s)
  })
})

describe('信令编解码', () => {
  it('offer 往返一致', () => {
    const desc = { type: 'offer' as const, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' }
    const code = encodeSignal(desc)
    expect(code.startsWith(SIGNAL_PREFIX)).toBe(true)
    const back = decodeSignal(code)
    expect(back).not.toBeNull()
    expect(back!.type).toBe('offer')
    expect(back!.sdp).toBe(desc.sdp)
  })

  it('answer 往返一致', () => {
    const code = encodeSignal({ type: 'answer', sdp: 'v=0\r\nanswer-sdp' })
    const back = decodeSignal(code)
    expect(back!.type).toBe('answer')
  })

  it('拒绝无前缀 / 垃圾 / 非法类型', () => {
    expect(decodeSignal('not-a-signal')).toBeNull()
    expect(decodeSignal(SIGNAL_PREFIX + '!!!not-base64!!!')).toBeNull()
    // 合法 base64 但类型不对
    const bad = SIGNAL_PREFIX + b64EncodeUtf8(JSON.stringify({ type: 'pranswer', sdp: 'x' }))
    expect(decodeSignal(bad)).toBeNull()
    // sdp 为空也视为无效
    const empty = SIGNAL_PREFIX + b64EncodeUtf8(JSON.stringify({ type: 'offer', sdp: '' }))
    expect(decodeSignal(empty)).toBeNull()
  })
})

describe('分块发送序列', () => {
  const meta = { accountId: 'acc-1', username: 'tiger4821' }

  it('结构为 meta + N 分块 + end', () => {
    const payload = 'x'.repeat(CHUNK_SIZE * 2 + 10)
    const seq = buildSendSequence(payload, meta)
    expect(seq.length).toBe(1 + 3 + 1) // meta + 3 chunks + end
    const head = JSON.parse(seq[0]) as WireMeta
    expect(head.t).toBe('meta')
    expect(head.chunks).toBe(3)
    expect(head.bytes).toBe(payload.length)
    expect(head.accountId).toBe('acc-1')
    expect(head.username).toBe('tiger4821')
    expect(JSON.parse(seq[seq.length - 1]).t).toBe('end')
  })

  it('空负载也有 meta + end', () => {
    const seq = buildSendSequence('', meta)
    expect(seq.length).toBe(2)
    expect((JSON.parse(seq[0]) as WireMeta).chunks).toBe(0)
  })
})

describe('ChunkReceiver 重组', () => {
  const meta = { accountId: 'acc-1', username: 'tiger4821' }

  function roundTrip(payload: string): string | null {
    const seq = buildSendSequence(payload, meta)
    const rec = new ChunkReceiver()
    let out: string | null = null
    for (const msg of seq) {
      const r = rec.feed(msg)
      if (r != null) out = r
    }
    return out
  }

  it('顺序到齐后还原完整负载（含中文）', () => {
    const payload = '数据管理 InfoDesk 🚀 ' + 'A'.repeat(CHUNK_SIZE * 2 + 5)
    expect(roundTrip(payload)).toBe(payload)
  })

  it('乱序到达也能正确重组', () => {
    const payload = 'B'.repeat(CHUNK_SIZE * 3 + 7)
    const seq = buildSendSequence(payload, meta)
    // 打乱 chunk 顺序（保持 meta 在最前、end 在最后更贴近真实，但这里彻底打乱中间）
    const head = seq[0]
    const end = seq[seq.length - 1]
    const middle = seq.slice(1, -1).reverse()
    const rec = new ChunkReceiver()
    let out: string | null = null
    for (const msg of [head, ...middle, end]) {
      const r = rec.feed(msg)
      if (r != null) out = r
    }
    expect(out).toBe(payload)
  })

  it('记录 meta 与接收进度', () => {
    const payload = 'C'.repeat(CHUNK_SIZE * 2)
    const seq = buildSendSequence(payload, meta)
    const rec = new ChunkReceiver()
    rec.feed(seq[0])
    expect(rec.meta?.username).toBe('tiger4821')
    expect(rec.progress).toBe(0)
    rec.feed(seq[1])
    expect(rec.progress).toBeCloseTo(0.5, 5)
  })

  it('忽略重复分块，不重复计数', () => {
    const payload = 'D'.repeat(10) // 单分块
    const seq = buildSendSequence(payload, meta)
    const rec = new ChunkReceiver()
    rec.feed(seq[0])
    rec.feed(seq[1])
    rec.feed(seq[1]) // 重复
    expect(rec.progress).toBe(1) // 只有 1 个分块，重复不计
  })

  it('空负载：meta + end 返回空字符串', () => {
    const seq = buildSendSequence('', meta)
    const rec = new ChunkReceiver()
    expect(rec.feed(seq[0])).toBeNull()
    expect(rec.feed(seq[1])).toBe('')
  })

  it('忽略无法解析的消息', () => {
    const rec = new ChunkReceiver()
    expect(rec.feed('not json')).toBeNull()
    expect(rec.progress).toBe(0)
  })

  it('缺块时收到 end 不返回损坏数据（返回 null）', () => {
    const payload = 'E'.repeat(CHUNK_SIZE * 3) // 3 个分块
    const seq = buildSendSequence(payload, meta)
    const rec = new ChunkReceiver()
    rec.feed(seq[0]) // meta
    rec.feed(seq[1]) // chunk 0
    // 故意跳过 chunk 1，直接喂 chunk 2 和 end
    rec.feed(seq[3])
    const end = seq[seq.length - 1]
    expect(rec.feed(end)).toBeNull() // 缺块 → 拒绝返回损坏数据
    // 但**不能**因此进入永久 done。原来这里是 done=true，而 feed() 开头
    // 就是 `if (this.done) return null`，于是接收器被永久卡死：
    // 后续所有消息被丢弃、onReceivedPayload 永不触发、没有超时兜底，
    // 界面上是两条永远不动的进度条。
    expect(rec.done).toBe(false)
    expect(rec.missing).toEqual([1])
  })

  it('缺块后补齐仍能正常完成（原来永久卡死）', () => {
    const payload = 'E'.repeat(CHUNK_SIZE * 3)
    const seq = buildSendSequence(payload, meta)
    const rec = new ChunkReceiver()
    rec.feed(seq[0]) // meta
    rec.feed(seq[1]) // chunk 0
    rec.feed(seq[3]) // chunk 2
    rec.feed(seq[seq.length - 1]) // end → 缺块，记 missing
    expect(rec.done).toBe(false)
    // 对端重发缺失的 chunk 1
    expect(rec.feed(seq[2])).toBeNull()
    // 再来一次 end 才收尾
    expect(rec.feed(seq[seq.length - 1])).toBe(payload)
    expect(rec.done).toBe(true)
  })
})

describe('连接失败原因分类', () => {
  const d = (o: Partial<{ realHost: number; mdnsHost: number; other: number }>) => ({
    realHost: 0,
    mdnsHost: 0,
    other: 0,
    gatherErrors: [],
    ...o,
  })

  it('一个候选都没有 → NO_CANDIDATE', () => {
    expect(classifyConnectFailure(d({}))).toBe('NO_CANDIDATE')
  })

  it('只有 mDNS 候选（授权前）→ MDNS_ONLY，而不是笼统的连接失败', () => {
    expect(classifyConnectFailure(d({ mdnsHost: 2 }))).toBe('MDNS_ONLY')
  })

  it('只有 srflx/relay 候选也算 MDNS_ONLY（没有真实内网地址可用）', () => {
    expect(classifyConnectFailure(d({ other: 1 }))).toBe('MDNS_ONLY')
  })

  it('mDNS 与真实 IP 都有 → 以真实 IP 为准，判为路由器隔离', () => {
    expect(classifyConnectFailure(d({ realHost: 1, mdnsHost: 1 }))).toBe('ISOLATED')
  })

  it('有真实内网 IP 仍失败 → ISOLATED', () => {
    expect(classifyConnectFailure(d({ realHost: 1 }))).toBe('ISOLATED')
  })
})
