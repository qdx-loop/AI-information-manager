import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Input,
  Button,
  Typography,
  Spin,
  Empty,
  Tag,
  Tooltip,
  Collapse,
  App,
  Upload,
  Dropdown,
  Space,
  theme as antdTheme,
} from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, ReloadOutlined, UndoOutlined, PaperClipOutlined, CloseOutlined, PictureOutlined, FileTextOutlined, BarChartOutlined, MessageOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { track } from '@/utils/track'
import { useAppStore } from '@/store/appStore'
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
import { useI18n } from '@/i18n'
import { tNow } from '@/i18n'
import { getSubStatus } from '@/utils/subscription'
import { AutoConfirmContext } from '@/ai/autoConfirm'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ContentPart } from '@/ai/types'
import ChartModal, { type ChartPayload } from './ChartModal'
import type { ChatMessage } from '@/ai/types'
import type { Library, FieldDef, Item, FieldType } from '@/types'
import { newId } from '@/utils/id'
import ConfirmActionModal from './ConfirmActionModal'
import ConfirmLibActionModal from './ConfirmLibActionModal'

const { Text } = Typography

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
  const { token } = antdTheme.useToken()
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
      saveSession(account.id, sessions.find((s) => s.id === sessionId) ?? { id: sessionId, title: '', updatedAt: Date.now() }, messages.map((m) => ({ role: m.role, content: m.content, thinking: m.thinking, steps: m.steps, chart: m.chart })))
    } catch {
      /* 存储异常时静默，不影响对话 */
    }
  }, [messages, sessionId, account?.id, sessions])

  // 首条用户消息懒取名：更新会话标题
  useEffect(() => {
    if (!account || !sessionId) return
    const firstUser = messages.find((m) => m.role === 'user')
    if (firstUser?.content) touchSessionTitle(account.id, sessionId, firstUser.content)
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
    if (!account) return
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
  // 流截断自动重试：每条用户消息只重试一次；重试时复用同一份会话构造
  const retryDoneRef = useRef(false)
  const chatMessagesRef = useRef<ChatMessage[] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [parsingFile, setParsingFile] = useState(false)
  const [chartPayload, setChartPayload] = useState<ChartPayload | null>(null)
  const autoConfirmRef = useRef<Set<string>>(new Set())
  const setAlwaysAllowFor = (k: string) => autoConfirmRef.current.add(k)
  // 内嵌图表：图表定义为消息附件


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
    if (tables.length > 0) fullText += '\n\n' + tables.map((t) => t.summary).join('\n\n')
    if (images.length > 0) fullText += `\n\n（本条消息附有 ${images.length} 张图片，请结合图片内容回答）`
    setAttachments([])

    setInput('')
    track('ai_message_sent')
    if (account) markObStep(account.id, 'ai')
    const userMsg: UIMessage = { role: 'user', content: fullText }
    const assistantMsg: UIMessage = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, assistantMsg])

    setLoading(true)
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
      const isStreamCut = errMsg.includes('响应中断') || errMsg.includes('参数不完整') || errMsg.includes('流被提前断开')
      // 流被异常截断（上游断流/网关中断）：静默自动重试一次，用户无感知恢复。
      // 仅重试一次且仅对此类瞬时故障——避免把真实错误（限流/未配置）反复请求。
      if (isStreamCut && !retryDoneRef.current) {
        retryDoneRef.current = true
        try {
          // 清掉可能残留的空 assistant 消息，重跑本轮对话
          setMessages((m) => {
            const last = m[m.length - 1]
            if (last && last.role === 'assistant' && !last.content.trim() && !last.steps?.length) {
              return m.slice(0, -1)
            }
            return m
          })
          const ctxs = await getContexts()
          await runConversation(chatMessagesRef.current!, ctxs)
        } catch (e2) {
          setMessages((m) =>
            m.map((msg, i) => {
              if (i !== m.length - 1) return msg
              const errContent = `⚠️ ${(e2 as Error).message}`
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
            const errContent = `⚠️ ${errMsg}`
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
      const msgs = messages
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
    let currentMessages = [...chatMessages]
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
          setMessages((m) =>
            m.map((msg, i) =>
              i === m.length - 1
                ? { ...msg, thinking: (msg.thinking ?? '') + delta }
                : msg,
            ),
          )
        },
      })

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
          if (itemId) {
            await locateAndFocus(itemId, contexts)
            pushStep(t('ai.step.locate'))
          }
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: '已定位并高亮显示。',
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

          // 弹窗等待用户确认；会话级 autoConfirm 直跳过
          const confirmed = autoConfirmRef.current.has('item')
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
            // 将 undo 信息附加到最近一条 assistant 消息
            if (undo) {
              // 反向找最新一条非 pending 的 assistant 消息附加撤回按钮，避免挂到历史消息上
              setMessages((m) => {
                for (let i = m.length - 1; i >= 0; i--) {
                  const msg = m[i]
                  if (msg.role === 'assistant' && !msg.pending) {
                    return [...m.slice(0, i), { ...msg, undo }, ...m.slice(i + 1)]
                  }
                }
                return m
              })
            }
          } catch (e) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `执行失败：${(e as Error).message}`,
            })
          }
        } else if (tc.function.name === 'save_memory') {
          // 结构化记忆：add / update / remove / replaceAll
          // 记忆跨会话生效且影响 AI 后续行为，必须经用户确认——防提示注入静默篡改（红队报告 P7）
          const op = (args as { op?: string }).op ?? 'replaceAll'
          const texts = Array.isArray((args as { texts?: unknown }).texts)
            ? ((args as { texts: string[] }).texts as string[])
            : []
          const OP_LABEL: Record<string, string> = {
            add: t('ai.confirm.memory.title.add'),
            update: t('ai.confirm.memory.title.update'),
            remove: t('ai.confirm.memory.title.remove'),
            replaceAll: t('ai.confirm.memory.title.replaceAll'),
          }
          const preview =
            op === 'update'
              ? `${t('ai.confirm.memory.target')}${String(texts[0] ?? '')}\n${t('ai.confirm.memory.newValue')}${String(texts[1] ?? '')}`
              : texts.map((t) => `· ${String(t)}`).join('\n')
          let result = ''
          if (!account) {
            result = '当前未登录，无法保存记忆。'
          } else if (autoConfirmRef.current.has('memory')) {
            // 会话内始终允许记忆更新：直接执行（防重复骚扰）
            result = execMemoryOp(op, texts)
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

          const confirmed = autoConfirmRef.current.has('lib')
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
            if (undo) {
              // 反向找最新一条非 pending 的 assistant 消息附加撤回按钮，避免挂到历史消息上
              setMessages((m) => {
                for (let i = m.length - 1; i >= 0; i--) {
                  const msg = m[i]
                  if (msg.role === 'assistant' && !msg.pending) {
                    return [...m.slice(0, i), { ...msg, undo }, ...m.slice(i + 1)]
                  }
                }
                return m
              })
            }
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

          const confirmed = autoConfirmRef.current.has('tpl')
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
            if (undo) {
              // 反向找最新一条非 pending 的 assistant 消息附加撤回按钮，避免挂到历史消息上
              setMessages((m) => {
                for (let i = m.length - 1; i >= 0; i--) {
                  const msg = m[i]
                  if (msg.role === 'assistant' && !msg.pending) {
                    return [...m.slice(0, i), { ...msg, undo }, ...m.slice(i + 1)]
                  }
                }
                return m
              })
            }
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

  async function locateAndFocus(itemId: string, contexts: LibraryContext[]) {
    for (const c of contexts) {
      const found = c.items.find((i) => i.id === itemId)
      if (found) {
        if (c.library.id !== currentLibraryId) {
          await selectLibrary(c.library.id)
          navigate(`/library/${c.library.id}`)
        }
        focusItem(itemId)
        return
      }
    }
  }

  async function executeAction(action: ItemAction): Promise<{ result: string; undo?: UndoInfo }> {
    const acc = account!
    // 只读宽限期内禁止 AI 写操作（create/update/delete 均拦截）
    if (acc.expiresAt != null && getSubStatus(acc.expiresAt) === 'grace') {
      return { result: tNow('sub.readonly.error') }
    }
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
          const itemToRestore: Item = { ...target, fields: oldFields }
          await getProvider().updateItem(itemToRestore)
          if (action.libraryId === currentLibraryId) await refreshCurrent()
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
    if (account && sessionId) {
      try {
        saveSession(account.id, sessions.find((s) => s.id === sessionId) ?? { id: sessionId, title: '', updatedAt: Date.now() }, [])
      } catch {
        /* 忽略 */
      }
    }
  }

  const handleUndo = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.undo) return
    // 只读宽限期内禁止撤销（撤销也是写操作，会绕过 store 守卫）
    if (account?.expiresAt != null && getSubStatus(account.expiresAt) === 'grace') {
      message.warning(tNow('sub.readonly.error'))
      return
    }
    try {
      await msg.undo.undo()
      // 移除 undo 信息，标记已撤回
      setMessages((m) =>
        m.map((mm, i) =>
          i === msgIndex
            ? { ...mm, undo: undefined, content: mm.content + t('ai.undoDone') }
            : mm,
        ),
      )
      message.success(t('ai.undoSuccess'))
    } catch (e) {
      message.error(t('ai.undoFailed', { msg: (e as Error).message }))
    }
  }, [messages, message])

  // 渲染消息内容：把 (id=xxx) 转成可点击 chip；assistant 消息按 markdown 渲染
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
            <Tooltip key={i} title={summary}>
              <Tag
                color="green"
                style={{ cursor: 'pointer', margin: '0 2px' }}
                onClick={() => locateAndFocus(itemId, contexts).catch((e) => message.error('定位条目失败：' + (e as Error).message))}
              >
                {summary.slice(0, 12) || itemId.slice(0, 6)}
              </Tag>
            </Tooltip>
          )
        }
      }
      if (!part) return null
      if (isAssistant) {
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

  if (!aiConfigured) {
    return (
      <div style={{ padding: 24, height: '100%' }}>
        <Empty
          image={<RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          description={t('ai.notConfigured')}
        >
          <Text type="secondary">
            {t('ai.notConfiguredHint')}
          </Text>
        </Empty>
      </div>
    )
  }

  return (
    <AutoConfirmContext.Provider
      value={{ alwaysAllowFor: autoConfirmRef.current, setAlwaysAllowFor }}
    >
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Dropdown
          open={sessionSwitcherOpen}
          onOpenChange={setSessionSwitcherOpen}
          trigger={['click']}
          menu={{
            items: [
              ...sessions.map((s) => ({
                key: s.id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 180 }}>
                    <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.id === sessionId ? 600 : 400 }}>
                      {s.title || t('ai.session.untitled')}
                    </span>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); removeSession(s.id) }}
                    />
                  </div>
                ),
              })),
              { type: 'divider' as const },
              { key: '__new__', label: <Space><PlusOutlined />{t('ai.session.new')}</Space> },
            ],
            onClick: ({ key }) => { if (key === '__new__') startNewSession(); else switchSession(key) },
          }}
        >
          <Button size="small" type="text" icon={<MessageOutlined />} style={{ maxWidth: 140 }}>
            <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessions.find((s) => s.id === sessionId)?.title || t('ai.session.untitled')}
            </span>
          </Button>
        </Dropdown>
        <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>{t('ai.allLibraries')}</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={handleClear} type="text" />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {messages.length === 0 ? (
          <Empty
            image={false}
            description={
              <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                {t('ai.emptyHint')}
              </span>
            }
          />
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: m.role === 'user' ? '#0D9488' : token.colorFillSecondary,
                  color: m.role === 'user' ? '#fff' : token.colorTextSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div
                style={{
                  background: m.role === 'user' ? '#0D9488' : token.colorFillTertiary,
                  color: m.role === 'user' ? '#fff' : token.colorText,
                  padding: '8px 12px',
                  borderRadius: 8,
                  maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {/* AI 思考过程（默认折叠） */}
                {m.thinking && (
                  <Collapse
                    size="small"
                    style={{
                      marginBottom: 8,
                      background: 'transparent',
                      border: 'none',
                    }}
                    items={[{
                      key: 'thinking',
                      label: <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{t('ai.thinking')}</span>,
                      children: (
                        <pre style={{ margin: 0, fontSize: 12, color: 'var(--ant-color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.thinking}
                        </pre>
                      ),
                    }]}
                  />
                )}
                {/* Agent 执行步骤（默认折叠） */}
                {m.steps && m.steps.length > 0 && (
                  <Collapse
                    size="small"
                    style={{
                      marginBottom: 8,
                      background: 'transparent',
                      border: 'none',
                    }}
                    items={[{
                      key: 'steps',
                      label: <span style={{ fontSize: 12, color: '#0D9488' }}>{t('ai.steps', { n: m.steps.length })}</span>,
                      children: (
                        <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                          {m.steps.map((s, si) => (
                            <div key={si} style={{ padding: '1px 0' }}>{si + 1}. {s}</div>
                          ))}
                        </div>
                      ),
                    }]}
                  />
                )}
                {m.pending && !m.content ? (
                  <Spin size="small" />
                ) : renderContent(m.content, lastContextsRef.current, m.role === 'assistant')}
                {m.chart && (
                  <div
                    onClick={() => setChartPayload(m.chart as ChartPayload)}
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 10,
                      background: 'rgba(128,128,128,0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <BarChartOutlined style={{ fontSize: 18, color: '#0D9488' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>{m.chart.title}</div>
                      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        {t('ai.chart.thumbHint')}
                      </div>
                    </div>
                  </div>
                )}
                {/* 撤回按钮 */}
                {m.undo && (
                  <Button
                    size="small"
                    type="link"
                    icon={<UndoOutlined />}
                    onClick={() => handleUndo(i)}
                    style={{ marginTop: 4, padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    {t('ai.undo', { label: m.undo.label })}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {attachments.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {attachments.map((a) => (
              <Tag
                key={a.id}
                closable
                closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
                onClose={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                icon={a.kind === 'image' ? <PictureOutlined /> : <FileTextOutlined />}
              >
                {a.name}
              </Tag>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            <Button size="small" icon={<PaperClipOutlined />} loading={parsingFile} title={t('ai.upload.tooltip')} />
          </Upload>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder={t('ai.inputPlaceholder')}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim()}
          />
        </div>
        {loading && (
          <Button size="small" type="link" onClick={handleStop} style={{ marginTop: 4 }}>
            {t('ai.stop')}
          </Button>
        )}
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
