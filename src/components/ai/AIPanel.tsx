import { useState, useRef, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Input, App, Upload, Dropdown } from 'antd'
import { SendOutlined, PaperClipOutlined, CloseOutlined, PictureOutlined, FileTextOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { track } from '@/utils/track'
import { useAppStore } from '@/store/appStore'
import { useAiUiStore } from '@/store/aiUiStore'
import { useAuthStore } from '@/store/authStore'
import { markObStep } from '@/utils/onboarding'
import {
  listSessions,
  newSession,
  saveSession,
  loadMessages,
  deleteSession,
  touchSessionTitle,
  renameSession,
  isSessionTitled,
  type SessionMeta,
} from '@/ai/sessions'
import { useLibraryStore } from '@/store/libraryStore'
import { getProvider } from '@/db/providerFactory'
import { chat } from '@/ai/client'
import { buildContext, SYSTEM_PROMPT, SYSTEM_PROMPT_EN, type LibraryContext } from '@/ai/contextBuilder'
import {
  ALL_TOOLS,
  parseItemAction,
  parseLibraryAction,
  parseTemplateAction,
  type ItemAction,
  type LibraryAction,
  type TemplateAction,
} from '@/ai/tools'
import {
  importLegacyMemory,
  memoryPrompt,
  addMemory,
  updateMemoryByIdxOrText,
  removeMemoryByIdxOrText,
  replaceAllMemory,
} from '@/ai/memory'
import { processAttachment, type Attachment } from '@/ai/attachments'
import { API_BASE, getToken } from '@/lib/serverApi'
import { normalizeChartOption } from '@/ai/chartUtils'
import { useI18n, tNow } from '@/i18n'
import { AutoConfirmContext, canAutoConfirm, type AutoConfirmKey } from '@/ai/autoConfirm'
import { plainStepLabel } from './clerkText'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ContentPart } from '@/ai/types'
import ChartModal, { type ChartPayload } from './ChartModal'
import type { ChatMessage } from '@/ai/types'
import type { Library, FieldDef, Item, FieldType } from '@/types'
import { newId } from '@/utils/id'
import ConfirmActionModal from './ConfirmActionModal'
import ConfirmLibActionModal from './ConfirmLibActionModal'

/**
 * 字号只引用 TOKENS §3 的档位；`--text-*` 由 Lead 在 theme 注入，
 * 这里带 px 兜底值，避免变量未就绪时字号掉回浏览器默认 16px 之外的意外值。
 */
const T = {
  md: 'var(--text-md, 16px)',
  base: 'var(--text-base, 14px)',
  sm: 'var(--text-sm, 13px)',
  xs: 'var(--text-xs, 12px)',
  xxs: 'var(--text-2xs, 11px)',
}

/** 顶栏/输入区的文字按钮：无底色、无边框，只靠颜色与字重区分 */
const textButton = {
  background: 'transparent',
  border: 'none',
  padding: '0 6px',
  height: 24,
  fontSize: T.xs,
  lineHeight: '24px',
  color: 'var(--app-ink-soft)',
  cursor: 'pointer',
} as const

interface UndoInfo {
  label: string
  undo: () => Promise<void>
}

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  thinking?: string
  steps?: string[] // agent 执行步骤（工具调用轨迹）
  undo?: UndoInfo
  /** 本消息附带的统计图（缩略展示，点击放大） */
  chart?: ChartPayload
}

// 工具调用轮数上限：放宽以覆盖批量录入、多步整理等长任务
const MAX_ROUNDS = 50

// 等待用户确认的 Promise resolver（用 ref 存储，避免多实例状态冲突）
// 注：当前 AIPanel 只有一个实例，但 ref 比模块级 let 更符合 React 模式

export default function AIPanel() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const t = useI18n()
  const { settings } = useAppStore()
  const { account } = useAuthStore()
  const confirmResolverRef = useRef<((action: ItemAction | null) => void) | null>(null)
  const libConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const {
    libraries,
    currentLibraryId,
    selectLibrary,
    focusItem,
    refreshCurrent,
    createLibrary,
    renameLibrary,
    setLibraryCategory,
    deleteLibrary,
    saveTemplate,
    deleteItem: storeDeleteItem,
    updateItem: storeUpdateItem,
  } = useLibraryStore()

  // —— 多会话管理：会话列表存 localStorage，切换器在面板顶部 ——
  const [sessions, setSessions] = useState<SessionMeta[]>(() => (account ? listSessions(account.id) : []))
  const [sessionId, setSessionId] = useState<string>(() => {
    if (!account) return ''
    const list = listSessions(account.id)
    if (list.length > 0) return list[0].id
    const s = newSession()
    saveSession(account.id, s, [])
    return s.id
  })
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState(false)

  // 当前会话消息（从会话存储加载；撤回器为闭包不序列化，恢复后撤回按钮自然失效）
  const [messages, setMessages] = useState<UIMessage[]>(() => (sessionId ? loadMessages(sessionId) as UIMessage[] : []))

  // 消息变化 → 持久化到当前会话
  useEffect(() => {
    if (!account || !sessionId) return
    try {
      // 这里必须重新从存储里读 meta，不能用 sessions state：
      // touchSessionTitle 只写 localStorage、不更新 sessions state，所以 state 里的
      // title 永远是 ''，saveSession 又把空标题兜底成「新会话」——每个流式增量都触发
      // 一次本 effect，于是刚命名好的标题被一秒内打回「新会话」。
      const stored = listSessions(account.id).find((s) => s.id === sessionId)
      const meta = stored ?? sessions.find((s) => s.id === sessionId) ?? { id: sessionId, title: '', updatedAt: Date.now() }
      saveSession(account.id, meta, messages.map((m) => ({ role: m.role, content: m.content, thinking: m.thinking, steps: m.steps, chart: m.chart })))
    } catch {
      /* 存储异常时静默，不影响对话 */
    }
    // sessions 只作兜底，不再作为依赖：它一变就整段重存，没有必要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sessionId, account?.id])

  // 首条用户消息懒取名：更新会话标题
  useEffect(() => {
    if (!account || !sessionId) return
    const firstUser = messages.find((m) => m.role === 'user')
    if (firstUser?.content) touchSessionTitle(account.id, sessionId, firstUser.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 第一条用户消息出现即起名，避免流式每个增量都重跑
  }, [messages.length, sessionId, account?.id])

  /** 切换会话：保存当前 → 加载目标 */
  const switchSession = (targetId: string) => {
    if (targetId === sessionId || loading) return
    setSessionId(targetId)
    setMessages(loadMessages(targetId) as UIMessage[])
    setSessionSwitcherOpen(false)
  }

  /** 新建会话并切换过去 */
  const startNewSession = () => {
    if (!account || loading) return // 与 switchSession 对称：传输中不切，否则在途写作流会撒到新会话上

    const s = newSession()
    saveSession(account.id, s, [])
    setSessions(listSessions(account.id))
    setSessionId(s.id)
    setMessages([])
    setSessionSwitcherOpen(false)
  }

  /** 删除会话：删掉后自动切到剩余最新会话（没有则新建空会话） */
  const removeSession = (delId: string) => {
    if (!account) return
    if (delId === sessionId && loading) return // 传输中不允许删当前
    const rest = deleteSession(account.id, delId)
    if (rest.length === 0) {
      const s = newSession()
      saveSession(account.id, s, [])
      setSessions([s])
      setSessionId(s.id)
      setMessages([])
    } else {
      setSessions(rest)
      if (delId === sessionId) {
        setSessionId(rest[0].id)
        setMessages(loadMessages(rest[0].id) as UIMessage[])
      }
    }
  }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    action: ItemAction
    library: Library | undefined
    fields: FieldDef[]
    existingItem: Item | null
  } | null>(null)
  const [pendingLibAction, setPendingLibAction] = useState<{
    libAction: LibraryAction | null
    tplAction: TemplateAction | null
    library: Library | undefined
    fields: FieldDef[]
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 卸载时中断在途请求。少了这个：AI 正在流式输出时退出登录（或被 401 watcher 踢下线），
  // AIDock 会因为 aiUiStore.mounted=false 而卸载本组件，但 fetch 还在跑 ——
  // 收尾照样弹「任务完成」，走到 executeAction 还会用上一个账号的身份继续写数据。
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])
  // 任务运行状态提到全局：面板关掉/收起时，外壳照样知道「后台还在跑」
  const beginRun = useAiUiStore((x) => x.beginRun)
  const endRun = useAiUiStore((x) => x.endRun)
  // 流截断自动重试：每条用户消息只重试一次；重试时复用同一份会话构造
  const retryDoneRef = useRef(false)
  const chatMessagesRef = useRef<ChatMessage[] | null>(null)
  // 每个渲染同步一次：异步回调（如流末尾的自动起名）需要读到最新的消息列表，
  // 而它们闭包里捕获的可能是发送时的那版 messages（含首轮才追加的用户消息），
  // 从那版列表取 firstUser 会全程找不到 → 自动命名永远不触发
  const messagesRef = useRef<UIMessage[]>(messages)
  messagesRef.current = messages
  const scrollRef = useRef<HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [parsingFile, setParsingFile] = useState(false)
  const [chartPayload, setChartPayload] = useState<ChartPayload | null>(null)

  // —— 「本会话内不再询问」：按动作分键；引用保持最新（任务闭包捕获的是渲染时的值）——
  const autoConfirmRef = useRef<Set<string>>(new Set())
  const [alwaysAllow, setAlwaysAllow] = useState<ReadonlySet<string>>(() => new Set<string>())
  const setAlwaysAllowFor = useCallback((key: AutoConfirmKey) => {
    // 先写进 ref（runConversation 的闭包读 ref），再同步一份到 state（弹窗 UI 读 state）
    autoConfirmRef.current.add(key)
    setAlwaysAllow(new Set(autoConfirmRef.current))
  }, [])

  // —— 撤回栈：同一轮多个写操作全部入栈，可连续「撤回上一操作」——
  // 原来的实现把 undo 挂在「最近一条 assistant 消息」上，同轮多个 tool_calls
  // 会互相覆盖，只剩最后一个能撤回（03-ai.md 风险 P1-1）。
  // 只保留最近 MAX_UNDO 步：够覆盖一次批量录入，又不会把整段会话的闭包一直挂在内存里。
  const MAX_UNDO = 20
  const [undoStack, setUndoStack] = useState<UndoInfo[]>([])
  // 执行步骤默认收起；按消息下标记展开态
  const [openedSteps, setOpenedSteps] = useState<ReadonlySet<number>>(() => new Set<number>())
  const [undoBusy, setUndoBusy] = useState(false)
  const pushUndo = useCallback((info: UndoInfo) => {
    setUndoStack((prev) => [...prev, info].slice(-MAX_UNDO))
  }, [])

  // 切换/新建会话时清空撤回栈与步骤展开态：
  // 撤回按钮属于「当前这段工作」，不该跨会话残留；步骤展开态是按消息下标记的，
  // 换会话后下标会指向另一条消息。
  useEffect(() => {
    setUndoStack([])
    setOpenedSteps(new Set<number>())
  }, [sessionId])


  // 服务端是否已配置平台代管 AI（GET 仅返回布尔值）
  const [platformAI, setPlatformAI] = useState(false)
  useEffect(() => {
    fetch('/api/ai/proxy')
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setPlatformAI(!!d.enabled))
      .catch(() => setPlatformAI(false))
  }, [])

  const usingPlatform = settings.ai.usePlatformAI === true && platformAI
  const aiConfigured =
    usingPlatform || !!(settings.ai.baseUrl && settings.ai.apiKey && settings.ai.model)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // 旧版纯文本记忆自动迁移为结构化记忆（幂等）
  useEffect(() => {
    if (account) importLegacyMemory(account.id, settings.ai.memory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  // 收集上下文数据
  // 全量数据上下文（带缓存）：accountId+dataVersion 为键，任何写操作后自动失效。
  // 修复"AI 工具调用很慢"的主因——此前每轮工具调用都全量重拉所有库。
  const contextsCacheRef = useRef<{ key: string; contexts: LibraryContext[] } | null>(null)
  async function getContexts(): Promise<LibraryContext[]> {
    const acc = account!
    const key = `${acc.id}#${useLibraryStore.getState().dataVersion}`
    if (contextsCacheRef.current?.key === key) return contextsCacheRef.current.contexts
    const allLibs = await getProvider().listLibraries(acc.id)
    // 并行拉取每库的模板与条目（原来是串行 for-await，库多时肉眼可见地慢）
    const result = await Promise.all(
      allLibs.map(async (lib) => {
        const [f, its] = await Promise.all([
          getProvider().getTemplate(lib.id),
          getProvider().listItems(lib.id),
        ])
        return { library: lib, fields: f, items: its } as LibraryContext
      }),
    )
    contextsCacheRef.current = { key, contexts: result }
    return result
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    if (!aiConfigured) return
    const userText = input.trim()

    // 附件处理：表格摘要并入文本；图片走多模态内容段
    const tables = attachments.filter((a) => (a.kind === 'table' || a.kind === 'text') && a.summary)
    const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl)
    let fullText = userText
    if (tables.length > 0) fullText += '\n\n' + tables.map((tbl) => tbl.summary).join('\n\n')
    if (images.length > 0) fullText += `\n\n（本条消息附有 ${images.length} 张图片，请结合图片内容回答）`
    setAttachments([])

    setInput('')
    track('ai_message_sent')
    if (account) markObStep(account.id, 'ai')
    const userMsg: UIMessage = { role: 'user', content: fullText }
    const assistantMsg: UIMessage = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, assistantMsg])

    setLoading(true)
    beginRun()
    let failed = false
    abortRef.current = new AbortController()

    try {
      const contexts = await getContexts()
      lastContextsRef.current = contexts
      const contextText = buildContext('all', contexts, currentLibraryId)

      // 组装对话消息：system + 上下文预览 + 记忆 + 历史 + 当前
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const systemPrompt = settings.ai.customPrompt || (settings.language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT)
      const memoryText = account ? memoryPrompt(account.id) : null
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `当前管理库数据上下文（预览）：\n${contextText}` },
        ...(memoryText ? [{ role: 'system' as const, content: memoryText }] : []),
        ...history,
        {
          role: 'user' as const,
          content:
            images.length > 0
              ? ([
                  { type: 'text', text: fullText },
                  ...images.map((img) => ({
                    type: 'image_url' as const,
                    image_url: { url: img.dataUrl as string },
                  })),
                ] as ContentPart[])
              : fullText,
        },
      ]

      // 多轮：可能 AI 连续调用工具，需循环处理
      chatMessagesRef.current = chatMessages
      await runConversation(chatMessages, contexts)
    } catch (e) {
      const err = e as Error
      // 用户主动停止（AbortError）：绝不重试，静默收尾
      if (err?.name === 'AbortError') {
        setMessages((m) =>
          m.map((msg, i) => (i === m.length - 1 ? { ...msg, pending: false } : msg)),
        )
        return
      }
      const errMsg = err.message ?? ''
      failed = true
      const isStreamCut = errMsg.includes('响应中断') || errMsg.includes('参数不完整') || errMsg.includes('流被提前断开')
      // 流被异常截断（上游断流/网关中断）：静默自动重试一次，用户无感知恢复。
      // 仅重试一次且仅对此类瞬时故障——避免把真实错误（限流/未配置）反复请求。
      if (isStreamCut && !retryDoneRef.current) {
        retryDoneRef.current = true
        try {
          // 清掉可能残留的空 assistant 消息，重跑本轮对话。
          // 注意只能「清空」不能「删掉」：onText 是按 `m[m.length - 1]` 追加文本的，
          // 删掉那条占位消息后最后一条就成了用户自己的提问，回答会被追加到用户气泡上。
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last && last.role === 'assistant' && !last.content.trim() && !last.steps?.length) {
              return m.map((msg, i) =>
                i === m.length - 1 ? { ...msg, content: '', thinking: '', pending: true } : msg,
              )
            }
            return m
          })
          const ctxs = await getContexts()
          await runConversation(chatMessagesRef.current!, ctxs)
        } catch (e2) {
          setMessages((m) =>
            m.map((msg, i) => {
              if (i !== m.length - 1) return msg
              const errContent = `出错了：${(e2 as Error).message}`
              return {
                ...msg,
                content: msg.content ? msg.content + '\n\n' + errContent : errContent,
                pending: false,
              }
            }),
          )
        }
      } else {
        setMessages((m) =>
          m.map((msg, i) => {
            if (i !== m.length - 1) return msg
            // 保留已流式生成的内容，仅在内容为空时显示错误
            const errContent = `出错了：${errMsg}`
            return {
              ...msg,
              content: msg.content ? msg.content + '\n\n' + errContent : errContent,
              pending: false,
            }
          }),
        )
      }
    } finally {
      setLoading(false)
      abortRef.current = null
      retryDoneRef.current = false
      // 通知外壳任务结束：面板关着的话会弹提示 + 在入口上点红点
      endRun(failed ? t('ai.doneFailed') : t('ai.doneOk'))
      // 会话首轮对话完成 → AI 自动命名（后台静默，失败降级到截取式标题）
      void maybeAutoTitle()
    }
  }

  /**
   * AI 自动会话命名（模仿主流 AI 应用）：
   *   触发：会话第一条消息完成回复后，一次性后台生成；
   *   输入：首条用户消息 + AI 首答摘要 → 模型产出 ≤12 字标题；
   *   约束：每会话只生成一次（titled 标记）；失败静默降级（保留截取标题）；不阻塞对话。
   */
  const maybeAutoTitle = useCallback(async () => {
    if (!account || !sessionId) return
    try {
      if (isSessionTitled(account.id, sessionId)) return
      const msgs = messagesRef.current
      const firstUser = msgs.find((m) => m.role === 'user')
      const firstAssistant = msgs.find((m) => m.role === 'assistant' && m.content?.trim())
      if (!firstUser?.content?.trim() || !firstAssistant) return
      // 首答可能很长（含 markdown/图表），截取前 300 字足够命名
      const answerSnippet = firstAssistant.content.slice(0, 300)

      const reply = await chat({
        baseUrl: settings.ai.baseUrl,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        viaProxy: usingPlatform,
        messages: [
          {
            role: 'system',
            content:
              settings.language === 'en'
                ? 'You are a chat title generator. Based on the user question and the assistant answer, produce a 2-8 word English title. Concise topic summary. No quotes, no punctuation at the end, no explanation — output the title only.'
                : '你是会话标题生成器。根据用户提问与助手回答，用简体中文生成一个 2-12 字的会话标题。要求：概括主题、不用引号句号等标点、不解释。直接输出标题本身。',
          },
          {
            role: 'user',
            content:
              settings.language === 'en'
                ? `User question: ${firstUser.content.slice(0, 500)}\nAssistant answer: ${answerSnippet}\n\nGenerate the chat title:`
                : `用户提问：${firstUser.content.slice(0, 500)}\n助手回答：${answerSnippet}\n\n请生成会话标题：`,
          },
        ],
        signal: AbortSignal.timeout?.(20_000) ?? undefined,
        maxTokens: 32,
      })

      const raw = (reply.content ?? '').trim()
      // 清洗：去掉模型可能带的引号/句号/"标题："前缀
      const title = raw
        .replace(/^["'「」『』""]+|["'「」『』""]+$/g, '')
        .replace(/^标题[:：]\s*/, '')
        .replace(/[。，,.!！?？~]/g, '')
        .slice(0, 12)
        .trim()
      if (title.length >= 2) {
        renameSession(account.id, sessionId, title)
        // 同步刷新本地会话列表（切换器立即显示新标题）
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title, titled: true, updatedAt: Date.now() } : s)),
        )
      }
    } catch {
      /* 命名失败静默降级：保留截取式标题，不打扰用户 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 账号切换才重建，深层用 account/settings 的最新值即可
  }, [account?.id, sessionId, messages, settings.ai, usingPlatform])

  // 向最近一条 assistant 消息追加执行步骤（agent 进度展示）
  // 从后往前找最新一条非 pending 的 assistant 消息，避免多轮对话时挂到历史消息上
  const pushStep = useCallback((label: string) => {
    setMessages((m) => {
      for (let i = m.length - 1; i >= 0; i--) {
        const msg = m[i]
        if (msg.role === 'assistant' && !msg.pending) {
          return [...m.slice(0, i), { ...msg, steps: [...(msg.steps ?? []), label] }, ...m.slice(i + 1)]
        }
      }
      return m
    })
  }, [])


  async function runConversation(
    chatMessages: ChatMessage[],
    contexts: LibraryContext[],
  ) {
    let rounds = 0
    const currentMessages = [...chatMessages]
    // 思考过程不再进 UI（改版：文档里不出现「折叠的思考盒」），但数据照旧写进
    // message.thinking 保留可追溯性；开发态额外打到 console，便于排查模型行为。
    let reasoningLog = ''
    while (rounds < MAX_ROUNDS) {
      rounds++
      const reply = await chat({
        baseUrl: settings.ai.baseUrl,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        viaProxy: usingPlatform,
        messages: currentMessages,
        tools: ALL_TOOLS,
        signal: abortRef.current!.signal,
        onText: (delta) => {
          setMessages((m) =>
            m.map((msg, i) =>
              i === m.length - 1 ? { ...msg, content: msg.content + delta, pending: false } : msg,
            ),
          )
        },
        onReasoning: (delta) => {
          if (import.meta.env.DEV) reasoningLog += delta
          setMessages((m) =>
            m.map((msg, i) =>
              i === m.length - 1
                ? { ...msg, thinking: (msg.thinking ?? '') + delta }
                : msg,
            ),
          )
        },
      })

      if (import.meta.env.DEV && reasoningLog) {
        console.debug('[clerk] reasoning:', reasoningLog)
        reasoningLog = ''
      }

      currentMessages.push(reply)

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        // 纯文本回复，结束
        setMessages((m) =>
          m.map((msg, i) => (i === m.length - 1 ? { ...msg, pending: false } : msg)),
        )
        return
      }

      // 有工具调用时，先停止当前消息的 pending 状态
      setMessages((m) =>
        m.map((msg, i) => (i === m.length - 1 ? { ...msg, pending: false } : msg)),
      )

      // 处理工具调用
      for (const tc of reply.tool_calls) {
        let args: unknown = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }

        if (tc.function.name === 'locate_item') {
          const itemId = (args as { itemId?: string }).itemId
          // 如实回报：找不到就说找不到。以前无论找没找到都回「已定位并高亮显示」，
          // 模型会据此认为定位成功（03-ai.md 风险 P2-4）。
          const found = itemId ? await locateAndFocus(itemId, contexts) : false
          if (found) pushStep(t('ai.step.locate'))
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: found
              ? '已定位并高亮显示。'
              : itemId
                ? `未找到条目 ${itemId}，未定位。请确认 id 是否正确、是否属于当前可访问的管理库。`
                : '缺少 itemId，未定位。',
          })
        } else if (tc.function.name === 'execute_item_action') {
          const libId = (args as { libraryId?: string }).libraryId ?? ''
          const libCtx = contexts.find((c) => c.library.id === libId)
          const libFields = libCtx?.fields ?? []
          const action = parseItemAction(args, libFields)
          if (!action) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: '操作参数无效，已拒绝。',
            })
            continue
          }
          // 找到现有条目（用于展示差异）
          const existing = action.itemId
            ? libCtx?.items.find((i) => i.id === action.itemId) ?? null
            : null

          // 弹窗等待用户确认；仅当用户对「同一个动作」勾过「不再询问」才跳过。
          // 删除永不跳过（canAutoConfirm 内部硬性拒绝破坏性动作）。
          const confirmed = canAutoConfirm(autoConfirmRef.current, 'item', action.action)
            ? action
            : await new Promise<ItemAction | null>((resolve) => {
                confirmResolverRef.current = resolve
                setPendingAction({
                  action,
                  library: libCtx?.library,
                  fields: libFields,
                  existingItem: existing,
                })
              })
          setPendingAction(null)

          if (!confirmed) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: '用户取消了该操作。',
            })
            pushStep(t('ai.step.itemActionCancelled', { action: action.action }))
            continue
          }

          // 执行操作
          try {
            const { result, undo } = await executeAction(confirmed)
            useLibraryStore.getState().bumpDataVersion()
            pushStep(t('ai.step.itemAction', { action: confirmed.action }))
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            })
            // 撤回句柄入栈：同一轮多个 tool_calls 全部保留，可连续撤回
            if (undo) pushUndo(undo)
          } catch (e) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `执行失败：${(e as Error).message}`,
            })
          }
        } else if (tc.function.name === 'save_memory') {
          // 结构化记忆：add / update / remove / replaceAll
          // 记忆跨会话生效且影响 AI 后续行为，必须经用户确认——防提示注入静默篡改（红队报告 P7）。
          // 这里**始终**确认：记忆的破坏性（replaceAll 能一次抹掉全部）比条目操作更隐蔽，
          // 不提供「不再询问」。另外 op 缺失不再默认成 replaceAll（旧实现会在模型漏参时
          // 整体覆盖记忆，03-ai.md 风险 P1-5）。
          const rawOp = (args as { op?: unknown }).op
          const MEM_OPS = ['add', 'update', 'remove', 'replaceAll'] as const
          const op =
            typeof rawOp === 'string' && (MEM_OPS as readonly string[]).includes(rawOp)
              ? rawOp
              : null
          const texts = Array.isArray((args as { texts?: unknown }).texts)
            ? ((args as { texts: string[] }).texts as string[])
            : []
          if (!op) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: '缺少有效的 op（add / update / remove / replaceAll），已拒绝执行。',
            })
            continue
          }
          const OP_LABEL: Record<string, string> = {
            add: t('ai.confirm.memory.title.add'),
            update: t('ai.confirm.memory.title.update'),
            remove: t('ai.confirm.memory.title.remove'),
            replaceAll: t('ai.confirm.memory.title.replaceAll'),
          }
          const preview =
            op === 'update'
              ? `${t('ai.confirm.memory.target')}${String(texts[0] ?? '')}\n${t('ai.confirm.memory.newValue')}${String(texts[1] ?? '')}`
              : texts.map((item) => `· ${String(item)}`).join('\n')
          let result = ''
          if (!account) {
            result = '当前未登录，无法保存记忆。'
          } else {
            const allowed = await new Promise<boolean>((resolve) => {
              modal.confirm({
                title: OP_LABEL[op] ?? t('ai.confirm.itemTitle'),
                content: (
                  <pre
                    style={{
                      maxHeight: 200,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 12,
                      margin: 0,
                    }}
                  >
                    {preview || '（空）'}
                  </pre>
                ),
                okText: t('ai.confirm.memory.allow'),
                cancelText: t('ai.confirm.memory.deny'),
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              })
            })
            if (!allowed) {
              result = '用户拒绝了该记忆操作。'
              pushStep(t('ai.step.memDenied'))
            } else {
              result = execMemoryOp(op, texts)
            }
          }
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          })
        } else if (tc.function.name === 'search_items') {
          const q = String((args as { query?: string }).query ?? '')
          const libraryId = (args as { libraryId?: string }).libraryId
          const fieldKey = (args as { fieldKey?: string }).fieldKey
          const limit = Math.min(Math.max(Number((args as { limit?: number }).limit ?? 20), 1), 50)
          try {
            const ctxs = await getContexts()
            const needle = q.toLowerCase()
            if (!needle) {
              pushStep(t('ai.step.searchNoQuery'))
              currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: '请提供搜索关键词 query。',
              })
            } else {
              const hits: string[] = []
              for (const c of ctxs) {
                if (libraryId && c.library.id !== libraryId) continue
                const visible = c.fields.filter((f) => f.visible && (!fieldKey || f.key === fieldKey))
                for (const it of c.items) {
                  const matched = visible.some((f) => {
                    const v = it.fields[f.key]
                    return v != null && String(v).toLowerCase().includes(needle)
                  })
                  if (!matched) continue
                  const vals = visible.map((f) => `${f.label}=${it.fields[f.key] ?? ''}`).join(', ')
                  hits.push(`「${c.library.name}」[id=${it.id}] ${vals}`)
                  if (hits.length >= limit) break
                }
                if (hits.length >= limit) break
              }
              pushStep(t('ai.step.search', { q, n: hits.length }))
              currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content:
                  hits.length > 0
                    ? `搜索到 ${hits.length} 条：\n${hits.join('\n')}`
                    : `没有找到包含「${q}」的条目。`,
              })
            }
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `搜索失败：${(e as Error).message}` })
          }
        } else if (tc.function.name === 'stat_items') {
          const { groupByField, valueField, filterText } = args as {
            groupByField?: string
            valueField?: string
            filterText?: string
          }
          const op = ((args as { op?: string }).op ?? 'count') as 'count' | 'sum' | 'avg'
          const libraryId = (args as { libraryId?: string }).libraryId
          try {
            const ctxs = await getContexts()
            const targets = libraryId ? ctxs.filter((c) => c.library.id === libraryId) : ctxs
            const lines: string[] = []
            for (const c of targets) {
              let items = c.items
              if (filterText) {
                const needle = filterText.toLowerCase()
                items = items.filter((it) =>
                  c.fields.some((f) => {
                    const v = it.fields[f.key]
                    return v != null && String(v).toLowerCase().includes(needle)
                  }),
                )
              }
              const head = `「${c.library.name}」（过滤后 ${items.length} 条）`
              if (op === 'count' && groupByField) {
                const field = c.fields.find((f) => f.key === groupByField || f.label === groupByField)
                if (!field) {
                  lines.push(`${head}: 找不到分组字段 ${groupByField}`)
                  continue
                }
                const groups = new Map<string, number>()
                for (const it of items) {
                  const k = String(it.fields[field.key] ?? '(空)')
                  groups.set(k, (groups.get(k) ?? 0) + 1)
                }
                lines.push(
                  `${head} 按「${field.label}」分组计数:\n` +
                    Array.from(groups.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, n]) => `  ${k}: ${n} 条`)
                      .join('\n'),
                )
              } else if ((op === 'sum' || op === 'avg') && valueField) {
                const field = c.fields.find((f) => f.key === valueField || f.label === valueField)
                if (!field) {
                  lines.push(`${head}: 找不到字段 ${valueField}`)
                  continue
                }
                const nums = items
                  .map((it) => Number(it.fields[field.key]))
                  .filter((n) => Number.isFinite(n))
                const total = nums.reduce((a, b) => a + b, 0)
                lines.push(
                  `${head} 「${field.label}」${op === 'sum' ? '总和' : '平均'} = ${
                    nums.length === 0 ? '无数据' : op === 'sum' ? total : (total / nums.length).toFixed(2)
                  }`,
                )
              } else {
                lines.push(`${head}`)
              }
            }
            pushStep(t('ai.step.stat'))
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: lines.join('\n\n') || '没有可统计的管理库。',
            })
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `统计失败：${(e as Error).message}` })
          }
        } else if (tc.function.name === 'list_libraries') {
          try {
            const ctxs = await getContexts()
            pushStep(t('ai.step.listLibs'))
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content:
                ctxs.length === 0
                  ? '当前没有任何管理库。'
                  : ctxs
                      .map((c) => {
                        const schema =
                          c.fields
                            .filter((f) => f.visible)
                            .map((f) => `${f.label}(${f.key})`)
                            .join(', ') || '(无字段)'
                        return `- 「${c.library.name}」 id=${c.library.id} 分类=${c.library.category || '无'} 共${c.items.length}条\n  字段: ${schema}`
                      })
                      .join('\n'),
            })
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `读取失败：${(e as Error).message}` })
          }
        } else if (tc.function.name === 'create_chart') {
          const title = String((args as { title?: string }).title ?? '统计图')
          const rawOption = (args as { option?: unknown }).option
          const option = normalizeChartOption(rawOption)
          if (option) {
            setChartPayload(null)
            setMessages((m) => {
              for (let i = m.length - 1; i >= 0; i--) {
                if (m[i].role === 'assistant' && !m[i].pending) {
                  return [...m.slice(0, i), { ...m[i], chart: { title, option } }, ...m.slice(i + 1)]
                }
              }
              return m
            })
            pushStep(t('ai.step.chart', { t: title }))
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `图表「${title}」已显示在对话中（点击放大、可下载为 PNG）。请用文字简要说明结论。`,
            })
          } else {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: '图表配置无效：请确保 option 中有 series 数组且每项含 type+数据 data；柱/折线还需要 xAxis.data 分类标签。修正后重新调用。',
            })
          }
        } else if (tc.function.name === 'fetch_url') {
          const url = String((args as { url?: string }).url ?? '')
          pushStep(t('ai.step.fetch', { url }))
          try {
            const res = await fetch(`${API_BASE}/api/ai/fetch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getToken() ?? ''}`,
              },
              body: JSON.stringify({ url }),
            })
            const data = (await res.json()) as { text?: string; title?: string; error?: string; truncated?: boolean }
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `「${data.title || url}」正文摘录：\n${data.text ?? ''}${data.truncated ? '\n(内容已截断)' : ''}`,
            })
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `抓取失败：${(e as Error).message}` })
          }
        } else if (tc.function.name === 'execute_library_action') {
          const libAction = parseLibraryAction(args)
          if (!libAction) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '操作参数无效，已拒绝。' })
            continue
          }
          const lib = libAction.libraryId
            ? contexts.find((c) => c.library.id === libAction.libraryId)?.library
            : undefined

          const confirmed = canAutoConfirm(autoConfirmRef.current, 'lib', libAction.action)
            ? true
            : await new Promise<boolean>((resolve) => {
                libConfirmResolverRef.current = resolve
                setPendingLibAction({ libAction, tplAction: null, library: lib, fields: [] })
              })
          setPendingLibAction(null)

          if (!confirmed) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '用户取消了该操作。' })
            pushStep(t('ai.step.libCancelled'))
            continue
          }
          try {
            const { result, undo } = await executeLibAction(libAction)
            useLibraryStore.getState().bumpDataVersion()
            pushStep(t('ai.step.libAction', { action: libAction.action }))
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
            if (undo) pushUndo(undo)
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `执行失败：${(e as Error).message}` })
          }
        } else if (tc.function.name === 'execute_template_action') {
          const tplAction = parseTemplateAction(args)
          if (!tplAction) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '操作参数无效，已拒绝。' })
            continue
          }
          const libCtx = contexts.find((c) => c.library.id === tplAction.libraryId)
          const libFields = libCtx?.fields ?? []

          const confirmed = canAutoConfirm(autoConfirmRef.current, 'tpl', tplAction.action)
            ? true
            : await new Promise<boolean>((resolve) => {
                libConfirmResolverRef.current = resolve
                setPendingLibAction({ libAction: null, tplAction, library: libCtx?.library, fields: libFields })
              })
          setPendingLibAction(null)

          if (!confirmed) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '用户取消了该操作。' })
            pushStep(t('ai.step.tplCancelled'))
            continue
          }
          try {
            const { result, undo } = await executeTplAction(tplAction)
            useLibraryStore.getState().bumpDataVersion()
            pushStep(t('ai.step.tplAction', { action: tplAction.action }))
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
            if (undo) pushUndo(undo)
          } catch (e) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: `执行失败：${(e as Error).message}` })
          }
        }
      }
      // 继续下一轮，让 AI 基于工具结果回复
      // 追加一条空的 assistant 消息用于流式接收
      const nextAssistant: UIMessage = { role: 'assistant', content: '', pending: true }
      setMessages((m) => [...m, nextAssistant])
    }
    // 达到轮数上限后，清理最后一条 pending 消息
    setMessages((m) =>
      m.map((msg, i) =>
        i === m.length - 1 && msg.pending
          ? { ...msg, pending: false, content: msg.content || t('ai.maxRounds', { n: MAX_ROUNDS }) }
          : msg,
      ),
    )
  }

  /** 定位并高亮条目；返回是否真的找到（调用方据此如实回报工具结果） */
  async function locateAndFocus(itemId: string, contexts: LibraryContext[]): Promise<boolean> {
    for (const c of contexts) {
      const found = c.items.find((i) => i.id === itemId)
      if (found) {
        if (c.library.id !== currentLibraryId) {
          await selectLibrary(c.library.id)
          navigate(`/library/${c.library.id}`)
        }
        focusItem(itemId)
        return true
      }
    }
    return false
  }

  async function executeAction(action: ItemAction): Promise<{ result: string; undo?: UndoInfo }> {
    const acc = account!
    if (action.action === 'delete') {
      if (!action.itemId) return { result: '缺少条目 ID' }
      await storeDeleteItem(action.itemId)
      if (action.libraryId === currentLibraryId) await refreshCurrent()
      return {
        result: `已删除条目 ${action.itemId}（已移入回收站）`,
        undo: {
          label: '删除条目',
          undo: async () => {
            await getProvider().restoreItem(action.itemId!)
            if (action.libraryId === currentLibraryId) await refreshCurrent()
          },
        },
      }
    }
    if (action.action === 'create') {
      // 获取目标库当前最大 sortOrder
      const existingItems = await getProvider().listItems(action.libraryId)
      const order = existingItems.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1
      const item: Item = {
        id: newId(),
        libraryId: action.libraryId,
        accountId: acc.id,
        fields: (action.fields ?? {}) as Item['fields'],
        pinned: false,
        sortOrder: order,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      }
      await getProvider().createItem(item)
      if (action.libraryId === currentLibraryId) await refreshCurrent()
      return {
        result: `已新增条目 ${item.id}`,
        undo: {
          label: '新增条目',
          undo: async () => {
            await getProvider().deleteItem(item.id)
            if (action.libraryId === currentLibraryId) await refreshCurrent()
          },
        },
      }
    }
    // update
    if (!action.itemId) return { result: '缺少条目 ID' }
    const existing = await getProvider().listItems(action.libraryId)
    const target = existing.find((i) => i.id === action.itemId)
    if (!target) return { result: `未找到条目 ${action.itemId}` }
    const oldFields = { ...target.fields }
    const updated: Item = {
      ...target,
      fields: { ...target.fields, ...(action.fields as Item['fields']) },
      updatedAt: Date.now(),
    }
    await storeUpdateItem(updated)
    if (action.libraryId === currentLibraryId) await refreshCurrent()
    return {
      result: `已修改条目 ${action.itemId}`,
      undo: {
        label: '修改条目',
        undo: async () => {
          // 先比对：在 AI 动作之后若用户手工编辑过这条，原本的 oldFields 覆盖式写回
          // 会把他改的字段静默丢掉。用 confirm 让他决定，不别走他的手工编辑。
          const live = (await getProvider().listItems(action.libraryId)).find(
            (i) => i.id === action.itemId,
          )
          const sameAsAfterAI =
            live && JSON.stringify(live.fields) === JSON.stringify(updated.fields)
          if (!live) {
            message.error('无法撤回：条目已不存在')
            return
          }
          let ok = !!sameAsAfterAI
          if (!ok) {
            ok = await new Promise<boolean>((resolve) => {
              modal.confirm({
                title: '还原此条目的 AI 修改？',
                content: 'AI 之后又有手工编辑，还原将覆盖掉它们。',
                okText: '覆盖并还原',
                cancelText: '保留现状',
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              })
            })
          }
          if (!ok) return
          const itemToRestore: Item = { ...live, fields: oldFields, updatedAt: Date.now() }
          await getProvider().updateItem(itemToRestore)
          if (action.libraryId === currentLibraryId) await refreshCurrent()
          message.success('已撤回')
        },
      },
    }
  }

  async function executeLibAction(action: LibraryAction): Promise<{ result: string; undo?: UndoInfo }> {
    if (action.action === 'create') {
      if (!action.name) return { result: '缺少管理库名称' }
      const id = await createLibrary(action.name, action.category || '默认', action.parentId ?? null)
      return {
        result: `已新建管理库「${action.name}」(id=${id})`,
        undo: {
          label: '新建管理库',
          undo: async () => {
            await deleteLibrary(id)
          },
        },
      }
    }
    if (!action.libraryId) return { result: '缺少管理库 ID' }
    if (action.action === 'rename') {
      if (!action.name) return { result: '缺少新名称' }
      const oldLib = libraries.find((l) => l.id === action.libraryId)
      const oldName = oldLib?.name ?? ''
      await renameLibrary(action.libraryId, action.name)
      return {
        result: `已重命名管理库 ${action.libraryId} 为「${action.name}」`,
        undo: {
          label: '重命名管理库',
          undo: async () => {
            await renameLibrary(action.libraryId!, oldName)
          },
        },
      }
    }
    if (action.action === 'delete') {
      await deleteLibrary(action.libraryId)
      return {
        result: `已删除管理库 ${action.libraryId}（已移入回收站）`,
        undo: {
          label: '删除管理库',
          undo: async () => {
            await useLibraryStore.getState().restoreLibrary(action.libraryId!)
          },
        },
      }
    }
    if (action.action === 'setCategory') {
      if (!action.category) return { result: '缺少分类' }
      const oldLib = libraries.find((l) => l.id === action.libraryId)
      const oldCategory = oldLib?.category ?? '默认'
      await setLibraryCategory(action.libraryId, action.category)
      return {
        result: `已修改管理库 ${action.libraryId} 的分类为「${action.category}」`,
        undo: {
          label: '修改分类',
          undo: async () => {
            await setLibraryCategory(action.libraryId!, oldCategory)
          },
        },
      }
    }
    return { result: '未知操作' }
  }

  async function executeTplAction(action: TemplateAction): Promise<{ result: string; undo?: UndoInfo }> {
    const libId = action.libraryId
    // 获取最新字段模板
    let fieldList = await getProvider().getTemplate(libId)

    if (action.action === 'addField') {
      if (!action.label) return { result: '缺少字段名' }
      const ftype: FieldType = action.type || 'text'
      const newField: FieldDef = {
        id: newId(),
        libraryId: libId,
        key: `field_${newId().slice(0, 8)}`,
        label: action.label,
        type: ftype,
        options: action.options ?? [],
        required: action.required ?? false,
        visible: action.visible ?? true,
        sortOrder: fieldList.length,
      }
      fieldList = [...fieldList, newField]
      await saveTemplate(libId, fieldList)
      return {
        result: `已新增字段「${action.label}」(key=${newField.key}, 类型=${ftype})`,
        undo: {
          label: '新增字段',
          undo: async () => {
            const latest = await getProvider().getTemplate(libId)
            await saveTemplate(libId, latest.filter((f) => f.id !== newField.id))
          },
        },
      }
    }

    if (action.action === 'updateField') {
      if (!action.fieldId) return { result: '缺少字段 ID' }
      const idx = fieldList.findIndex((f) => f.id === action.fieldId)
      if (idx === -1) return { result: `未找到字段 ${action.fieldId}` }
      const oldField = { ...fieldList[idx] }
      fieldList = fieldList.map((f) =>
        f.id === action.fieldId
          ? {
              ...f,
              label: action.label ?? f.label,
              type: action.type ?? f.type,
              options: action.options ?? f.options,
              required: action.required ?? f.required,
              visible: action.visible ?? f.visible,
            }
          : f,
      )
      await saveTemplate(libId, fieldList)
      return {
        result: `已修改字段 ${action.fieldId}`,
        undo: {
          label: '修改字段',
          undo: async () => {
            const latest = await getProvider().getTemplate(libId)
            await saveTemplate(libId, latest.map((f) => (f.id === oldField.id ? oldField : f)))
          },
        },
      }
    }

    if (action.action === 'deleteField') {
      if (!action.fieldId) return { result: '缺少字段 ID' }
      const deletedField = fieldList.find((f) => f.id === action.fieldId)
      fieldList = fieldList.filter((f) => f.id !== action.fieldId)
      await saveTemplate(libId, fieldList)
      return {
        result: `已删除字段 ${action.fieldId}`,
        undo: deletedField
          ? {
              label: '删除字段',
              undo: async () => {
                const latest = await getProvider().getTemplate(libId)
                await saveTemplate(libId, [...latest, deletedField])
              },
            }
          : undefined,
      }
    }

    return { result: '未知操作' }
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    confirmResolverRef.current?.(pendingAction.action)
    confirmResolverRef.current = null
  }
  const handleCancelAction = () => {
    confirmResolverRef.current?.(null)
    confirmResolverRef.current = null
    setPendingAction(null)
  }
  function execMemoryOp(op: string, texts: string[]): string {
    if (!account) return '当前未登录，无法保存记忆。'
    if (op === 'add') {
      const n = addMemory(account.id, texts)
      pushStep(t('ai.step.memAdd', { n }))
      return n > 0 ? `已新增 ${n} 条记忆。` : '没有新增（内容为空或与已有记忆重复）。'
    }
    if (op === 'update') {
      const idxOrText = String(texts[0] ?? '')
      const newText = String(texts[1] ?? '')
      const ok = updateMemoryByIdxOrText(account.id, idxOrText, newText)
      pushStep(t('ai.step.memUpdate'))
      return ok ? '记忆已更新。' : '未找到要更新的记忆条目。'
    }
    if (op === 'remove') {
      const n = removeMemoryByIdxOrText(account.id, texts.map(String))
      pushStep(t('ai.step.memDelete', { n }))
      return n > 0 ? `已删除 ${n} 条记忆。` : '未找到要删除的记忆条目。'
    }
    replaceAllMemory(account.id, texts)
    pushStep(t('ai.step.memReplace'))
    return `记忆已整体替换，当前共 ${texts.filter(Boolean).length} 条。`
  }

  const handleConfirmLibAction = async () => {
    libConfirmResolverRef.current?.(true)
    libConfirmResolverRef.current = null
  }
  const handleCancelLibAction = () => {
    libConfirmResolverRef.current?.(false)
    libConfirmResolverRef.current = null
    setPendingLibAction(null)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleClear = () => {
    // 清空当前会话内容（保留会话本身）
    setMessages([])
    setUndoStack([])
    if (account && sessionId) {
      try {
        saveSession(account.id, sessions.find((s) => s.id === sessionId) ?? { id: sessionId, title: '', updatedAt: Date.now() }, [])
      } catch {
        /* 忽略 */
      }
    }
  }

  /**
   * 撤回上一操作（可连续点）。
   * 失败时**不从栈里删除**、按钮保留，用户能再试一次；成功才出栈。
   * 旧实现是挂在消息上的单个闭包按钮，同轮多写只剩最后一个、刷新即失效。
   */
  const handleUndoLast = useCallback(async () => {
    const top = undoStack[undoStack.length - 1]
    if (!top || undoBusy) return
    setUndoBusy(true)
    try {
      await top.undo()
      setUndoStack((prev) => prev.slice(0, -1))
      message.success(tNow('ai.undoSuccess'))
    } catch (e) {
      message.error(tNow('ai.undoFailed', { msg: (e as Error).message }))
    } finally {
      setUndoBusy(false)
    }
  }, [undoStack, undoBusy, message])

  // 渲染消息内容：把 (id=xxx) 转成可点击的行内条目引用；assistant 消息按 markdown 渲染。
  // 改版要点：条目引用不再用彩色 Tag（那是「卡片/胶囊」语汇），改成朱砂文字 + 点线下划线。
  const renderContent = (text: string, contexts: LibraryContext[] | null, isAssistant = false) => {
    if (!text) return null
    const parts = text.split(/(\(id=[^)]+\))/g)
    return parts.map((part, i) => {
      const m = part.match(/\(id=([^)]+)\)/)
      if (m && contexts) {
        const itemId = m[1]
        const lib = contexts.find((c) => c.items.some((it) => it.id === itemId))
        const item = lib?.items.find((it) => it.id === itemId)
        if (item) {
          const summary = Object.values(item.fields).filter((v) => v != null && v !== '').join(' ')
          return (
            <button
              key={i}
              type="button"
              title={summary}
              onClick={() =>
                void locateAndFocus(itemId, contexts).catch((e) =>
                  message.error(t('ai.locate.failed', { msg: (e as Error).message })),
                )
              }
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0 2px',
                color: 'var(--app-accent-text)',
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.86em',
                cursor: 'pointer',
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
                textUnderlineOffset: 3,
              }}
            >
              {summary.slice(0, 12) || itemId.slice(0, 6)}
            </button>
          )
        }
      }
      if (!part) return null
      if (isAssistant) {
        // `.ai-md` 由 Lead 的全局排版样式接管正文（16/1.75、段间距）；
        // 这里不回退成聊天气泡的 maxWidth/底色。
        return (
          <div key={i} className="ai-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
          </div>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  // 缓存最近一次上下文供 renderContent 用（在 handleSend 中更新）
  const lastContextsRef = useRef<LibraryContext[] | null>(null)

  // 执行步骤：一行「已核对 N 步 ▾」，展开是 01/02/03 的编号小字。
  // 旧实现用 antd Collapse + emoji 文案，看起来像聊天组件而不是批注。
  const toggleSteps = (idx: number) => {
    setOpenedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // ⌘/Ctrl+Enter 发送；Enter 直接发送、Shift+Enter 换行（保留原有的粘贴 Excel 场景）
  const handleComposerKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void handleSend()
  }

  const renderSteps = (m: UIMessage, idx: number) => {
    if (!m.steps || m.steps.length === 0) return null
    const open = openedSteps.has(idx)
    return (
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleSteps(idx)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: T.xs,
            lineHeight: '20px',
            color: 'var(--app-ink-faint)',
            cursor: 'pointer',
          }}
        >
          <span>{t('ai.steps.summary', { n: m.steps.length })}</span>
          <span
            aria-hidden
            style={{
              fontSize: 10,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 160ms cubic-bezier(.2,.7,.2,1)',
            }}
          >
            ▾
          </span>
        </button>
        {open && (
          <ol style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {m.steps.map((s, si) => (
              <li
                key={si}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '1px 0',
                  fontSize: T.xs,
                  lineHeight: 1.6,
                  color: 'var(--app-ink-soft)',
                }}
              >
                <span
                  className="mono num"
                  style={{ minWidth: 18, color: 'var(--app-ink-faint)', fontSize: T.xxs }}
                >
                  {String(si + 1).padStart(2, '0')}
                </span>
                <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{plainStepLabel(s)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  }

  // 运行态：12px 文字 + 2px 朱砂短条（静态，不闪不呼吸）。
  // TOKENS §6 禁止无限循环动画，`.clerk-run` 的外观由 Lead 的全局 CSS 定义。
  const runningLine = (
    <div style={{ margin: '4px 0 20px' }} aria-live="polite">
      <div style={{ fontSize: T.xs, color: 'var(--app-ink-faint)', marginBottom: 6 }}>
        {t('ai.running')}
      </div>
      <div
        role="progressbar"
        aria-label={t('ai.running')}
        style={{ height: 2, background: 'var(--app-rule)', overflow: 'hidden' }}
      >
        <div
          className="clerk-run"
          style={{ height: 2, width: '32%', background: 'var(--app-accent)' }}
        />
      </div>
    </div>
  )

  if (!aiConfigured) {
    return (
      // 说明文字是长句，必须是块级并限宽，否则在停靠面板里会横向溢出被裁掉
      <div style={{ padding: '24px 20px', height: '100%', minWidth: 0, overflow: 'auto' }}>
        <div
          className="serif"
          style={{ fontSize: 20, lineHeight: 1.4, color: 'var(--app-ink)', marginBottom: 10 }}
        >
          {t('ai.notConfigured')}
        </div>
        <div
          style={{
            maxWidth: 320,
            lineHeight: 1.75,
            fontSize: T.sm,
            color: 'var(--app-ink-faint)',
          }}
        >
          {t('ai.notConfiguredHint')}
        </div>
      </div>
    )
  }

  return (
    <AutoConfirmContext.Provider value={{ alwaysAllowFor: alwaysAllow, setAlwaysAllowFor }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        {/* 顶部 40px 工具栏：衬线 16「书记员」+ 会话/清空文字按钮 */}
        <div
          style={{
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            borderBottom: '1px solid var(--app-rule)',
          }}
        >
          <span className="serif" style={{ fontSize: 16, lineHeight: '40px', color: 'var(--app-ink)' }}>
            {t('ai.clerk')}
          </span>
          <span style={{ flex: 1, minWidth: 0 }} />
          <Dropdown
            open={sessionSwitcherOpen}
            onOpenChange={setSessionSwitcherOpen}
            trigger={['click']}
            menu={{
              items: [
                ...sessions.map((s) => ({
                  key: s.id,
                  label: (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 180,
                      }}
                    >
                      <span
                        style={{
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: T.xs,
                          fontWeight: s.id === sessionId ? 600 : 400,
                        }}
                      >
                        {s.title || t('ai.session.untitled')}
                      </span>
                      <button
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSession(s.id)
                        }}
                        style={{ ...textButton, padding: '0 2px', height: 20, color: 'var(--app-ink-faint)' }}
                      >
                        <DeleteOutlined style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  ),
                })),
                { type: 'divider' as const },
                {
                  key: '__new__',
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.xs }}>
                      <PlusOutlined style={{ fontSize: 12 }} />
                      {t('ai.session.new')}
                    </span>
                  ),
                },
              ],
              onClick: ({ key }) => {
                if (key === '__new__') startNewSession()
                else switchSession(key)
              },
            }}
          >
            <button
              type="button"
              style={textButton}
              title={t('ai.session.switch')}
              aria-label={t('ai.session.switch')}
            >
              <span
                style={{
                  maxWidth: 96,
                  display: 'inline-block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'bottom',
                }}
              >
                {sessions.find((s) => s.id === sessionId)?.title || t('ai.session.untitled')}
              </span>
            </button>
          </Dropdown>
          <button
            type="button"
            // 一键抹掉整段对话必须确认；图标换成文字，避免纯图标按钮承载破坏性操作
            onClick={() =>
              modal.confirm({
                title: t('ai.session.clearTitle'),
                content: t('ai.session.delConfirm'),
                okText: t('common.confirm'),
                okButtonProps: { danger: true },
                cancelText: t('common.cancel'),
                onOk: handleClear,
              })
            }
            style={textButton}
            aria-label={t('ai.session.clear')}
            title={t('ai.session.clear')}
          >
            {t('ai.session.clear')}
          </button>
        </div>

        {/* 主体 = 一篇文档：用户输入左侧朱砂立线，AI 输出正文；没有气泡与头像 */}
        <div
          ref={scrollRef}
          className="doc"
          style={{ flex: 1, overflow: 'auto', padding: '20px 16px 4px', minWidth: 0 }}
        >
          {messages.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 24, maxWidth: 320 }}>
              <div
                className="serif"
                style={{ fontSize: 20, lineHeight: 1.4, color: 'var(--app-ink)', marginBottom: 10 }}
              >
                {t('ai.clerk')}
              </div>
              <div style={{ fontSize: T.sm, lineHeight: 1.75, color: 'var(--app-ink-faint)' }}>
                {t('ai.emptyHint')}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === 'user' ? (
                <div
                  key={i}
                  style={{
                    borderLeft: '2px solid var(--app-accent)',
                    paddingLeft: 12,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: T.base,
                      lineHeight: 1.6,
                      color: 'var(--app-ink)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {renderContent(m.content, lastContextsRef.current)}
                  </div>
                </div>
              ) : (
                <div key={i} style={{ marginBottom: 24, minWidth: 0 }}>
                  {renderSteps(m, i)}
                  {m.content ? (
                    <div
                      style={{
                        fontSize: T.md,
                        lineHeight: 1.75,
                        color: 'var(--app-ink)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {renderContent(m.content, lastContextsRef.current, true)}
                    </div>
                  ) : null}
                  {/* 图表缩略：一行标题 + mono 图注，点击进弹窗 */}
                  {m.chart && (
                    <button
                      type="button"
                      onClick={() => setChartPayload(m.chart as ChartPayload)}
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        flexWrap: 'wrap',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          fontSize: T.base,
                          color: 'var(--app-ink)',
                          textDecorationLine: 'underline',
                          textDecorationStyle: 'dotted',
                          textUnderlineOffset: 3,
                        }}
                      >
                        {m.chart.title}
                      </span>
                      <span className="mono" style={{ fontSize: T.xxs, color: 'var(--app-ink-faint)' }}>
                        {t('ai.chart.thumbHint')}
                      </span>
                    </button>
                  )}
                </div>
              ),
            )
          )}
          {loading && runningLine}
        </div>

        {/* 输入区：32px 输入条 + 墨色发送键；撤回栈入口放在输入条上方右侧 */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--app-rule)',
            padding: '8px 12px 10px',
          }}
        >
          {undoStack.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                type="button"
                disabled={undoBusy}
                onClick={() => void handleUndoLast()}
                style={{
                  ...textButton,
                  height: 20,
                  lineHeight: '20px',
                  fontSize: T.xs,
                  color: 'var(--app-ink-soft)',
                  opacity: undoBusy ? 0.38 : 1,
                  cursor: undoBusy ? 'not-allowed' : 'pointer',
                }}
              >
                {t('ai.undo.last')}
                {undoStack[undoStack.length - 1]?.label
                  ? ` · ${undoStack[undoStack.length - 1].label}`
                  : ''}
              </button>
            </div>
          )}
          {attachments.length > 0 && (
            <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {attachments.map((a) => (
                <span
                  key={a.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: T.xs,
                    color: 'var(--app-ink-soft)',
                    border: '1px solid var(--app-border)',
                    borderRadius: 2,
                    padding: '2px 6px',
                  }}
                >
                  {a.kind === 'image' ? (
                    <PictureOutlined style={{ fontSize: 12 }} />
                  ) : (
                    <FileTextOutlined style={{ fontSize: 12 }} />
                  )}
                  <span
                    style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {a.name}
                  </span>
                  <button
                    type="button"
                    aria-label={t('common.close')}
                    onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                    style={{ ...textButton, height: 16, lineHeight: '16px', padding: 0 }}
                  >
                    <CloseOutlined style={{ fontSize: 10 }} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <Upload
              accept="*/*"
              showUploadList={false}
              multiple
              beforeUpload={(file) => {
                void (async () => {
                  try {
                    setParsingFile(true)
                    const att = await processAttachment(file as File)
                    setAttachments((prev) => [...prev, att])
                  } catch (e) {
                    message.error((e as Error).message)
                  } finally {
                    setParsingFile(false)
                  }
                })()
                return false
              }}
            >
              <button
                type="button"
                title={t('ai.upload.tooltip')}
                aria-label={t('ai.upload.tooltip')}
                style={{
                  ...textButton,
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                  color: parsingFile ? 'var(--app-ink-faint)' : 'var(--app-ink-soft)',
                  opacity: parsingFile ? 0.38 : 1,
                }}
              >
                <PaperClipOutlined style={{ fontSize: 16 }} />
              </button>
            </Upload>
            {/* 必须保留多行：占位符宣传的是「粘贴 Excel 交给 AI 录入」，
                单行输入会把粘贴来的 20 行压成一行。视觉上仍是 32px 输入条。 */}
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={t('ai.inputPlaceholder')}
              disabled={loading}
              autoSize={{ minRows: 1, maxRows: 5 }}
              style={{
                flex: 1,
                minHeight: 32,
                padding: '5px 8px',
                fontSize: T.sm,
                lineHeight: 1.6,
                background: 'transparent',
                border: '1px solid var(--app-border)',
                borderRadius: 2,
                boxShadow: 'none',
                resize: 'none',
              }}
              aria-label={t('ai.inputPlaceholder')}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              aria-label={t('ai.send')}
              title={t('ai.send')}
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 4,
                border: '1px solid transparent',
                background: !input.trim() || loading ? 'var(--app-border)' : 'var(--app-action)',
                color: 'var(--app-canvas)',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              <SendOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              minHeight: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: T.xxs, color: 'var(--app-ink-faint)' }}>
              {loading ? t('ai.running') : ''}
            </span>
            {loading && (
              <button
                type="button"
                onClick={handleStop}
                style={{ ...textButton, height: 16, lineHeight: '16px', fontSize: T.xs }}
              >
                {t('ai.stop')}
              </button>
            )}
          </div>
        </div>

        <ChartModal payload={chartPayload} onClose={() => setChartPayload(null)} />

        <ConfirmActionModal
          open={!!pendingAction}
          action={pendingAction?.action ?? null}
          library={pendingAction?.library}
          fields={pendingAction?.fields ?? []}
          existingItem={pendingAction?.existingItem ?? null}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />

        <ConfirmLibActionModal
          open={!!pendingLibAction}
          libAction={pendingLibAction?.libAction ?? null}
          tplAction={pendingLibAction?.tplAction ?? null}
          library={pendingLibAction?.library}
          fields={pendingLibAction?.fields ?? []}
          onConfirm={handleConfirmLibAction}
          onCancel={handleCancelLibAction}
        />
      </div>
    </AutoConfirmContext.Provider>
  )
}
