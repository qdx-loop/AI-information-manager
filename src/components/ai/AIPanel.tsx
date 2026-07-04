import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Input,
  Button,
  Space,
  Select,
  Typography,
  Spin,
  Empty,
  Tag,
  Tooltip,
  Collapse,
  App,
} from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { getProvider } from '@/db/providerFactory'
import { chat } from '@/ai/client'
import { buildContext, SYSTEM_PROMPT, type LibraryContext } from '@/ai/contextBuilder'
import { ALL_TOOLS, parseItemAction, parseLibraryAction, parseTemplateAction, type ItemAction, type LibraryAction, type TemplateAction } from '@/ai/tools'
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
  undo?: UndoInfo
}

// 等待用户确认的 Promise resolver
let confirmResolver: ((action: ItemAction | null) => void) | null = null
let libConfirmResolver: ((confirmed: boolean) => void) | null = null

export default function AIPanel() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { settings, setAI } = useAppStore()
  const { account } = useAuthStore()
  const {
    libraries,
    currentLibraryId,
    fields,
    items,
    selectLibrary,
    focusItem,
    refreshCurrent,
    createLibrary,
    renameLibrary,
    setLibraryCategory,
    deleteLibrary,
    saveTemplate,
  } = useLibraryStore()

  const [scope, setScope] = useState(settings.ai.scope)
  const [messages, setMessages] = useState<UIMessage[]>([])
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const aiConfigured = !!(settings.ai.baseUrl && settings.ai.apiKey && settings.ai.model)

  useEffect(() => {
    setAI({ scope })
  }, [scope, setAI])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // 收集上下文数据
  async function gatherContext(): Promise<LibraryContext[]> {
    const acc = account!
    if (scope === 'current') {
      if (!currentLibraryId) return []
      const lib = libraries.find((l) => l.id === currentLibraryId)
      if (!lib) return []
      return [{ library: lib, fields, items }]
    }
    // 全部库
    const allLibs = await getProvider().listLibraries(acc.id)
    const result: LibraryContext[] = []
    for (const lib of allLibs) {
      const [f, its] = await Promise.all([
        getProvider().getTemplate(lib.id),
        getProvider().listItems(lib.id),
      ])
      result.push({ library: lib, fields: f, items: its })
    }
    return result
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    if (!aiConfigured) return
    const userText = input.trim()
    setInput('')
    const userMsg: UIMessage = { role: 'user', content: userText }
    const assistantMsg: UIMessage = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, assistantMsg])

    setLoading(true)
    abortRef.current = new AbortController()

    try {
      const contexts = await gatherContext()
      lastContextsRef.current = contexts
      const contextText = buildContext(scope, contexts, currentLibraryId)

      // 组装 OpenAI 消息：system + context + 记忆 + 历史 + 当前
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const systemPrompt = settings.ai.customPrompt || SYSTEM_PROMPT
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `当前管理库数据上下文：\n${contextText}` },
        ...(settings.ai.memory
          ? [{ role: 'system' as const, content: `以下是你的长期记忆（用户偏好与重要信息，请在回答时参考）：\n${settings.ai.memory}` }]
          : []),
        ...history,
        { role: 'user', content: userText },
      ]

      // 多轮：可能 AI 连续调用工具，需循环处理
      await runConversation(chatMessages, contexts)
    } catch (e) {
      setMessages((m) =>
        m.map((msg, i) => {
          if (i !== m.length - 1) return msg
          // 保留已流式生成的内容，仅在内容为空时显示错误
          const errContent = `⚠️ ${(e as Error).message}`
          return {
            ...msg,
            content: msg.content ? msg.content + '\n\n' + errContent : errContent,
            pending: false,
          }
        }),
      )
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  async function runConversation(
    chatMessages: ChatMessage[],
    contexts: LibraryContext[],
  ) {
    let rounds = 0
    let currentMessages = [...chatMessages]
    while (rounds < 5) {
      rounds++
      const reply = await chat({
        baseUrl: settings.ai.baseUrl,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
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

          // 弹窗等待用户确认
          const confirmed = await new Promise<ItemAction | null>((resolve) => {
            confirmResolver = resolve
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
            continue
          }

          // 执行操作
          try {
            const { result, undo } = await executeAction(confirmed)
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            })
            // 将 undo 信息附加到最近一条 assistant 消息
            if (undo) {
              setMessages((m) => {
                let attached = false
                return m.map((msg) => {
                  if (!attached && msg.role === 'assistant' && !msg.pending) {
                    attached = true
                    return { ...msg, undo }
                  }
                  return msg
                })
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
          const memContent = (args as { content?: string }).content ?? ''
          setAI({ memory: memContent })
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: '记忆已保存。',
          })
        } else if (tc.function.name === 'execute_library_action') {
          const libAction = parseLibraryAction(args)
          if (!libAction) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '操作参数无效，已拒绝。' })
            continue
          }
          const lib = libAction.libraryId
            ? contexts.find((c) => c.library.id === libAction.libraryId)?.library
            : undefined

          const confirmed = await new Promise<boolean>((resolve) => {
            libConfirmResolver = resolve
            setPendingLibAction({ libAction, tplAction: null, library: lib, fields: [] })
          })
          setPendingLibAction(null)

          if (!confirmed) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '用户取消了该操作。' })
            continue
          }
          try {
            const { result, undo } = await executeLibAction(libAction)
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
            if (undo) {
              setMessages((m) => {
                let attached = false
                return m.map((msg) => {
                  if (!attached && msg.role === 'assistant' && !msg.pending) {
                    attached = true
                    return { ...msg, undo }
                  }
                  return msg
                })
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

          const confirmed = await new Promise<boolean>((resolve) => {
            libConfirmResolver = resolve
            setPendingLibAction({ libAction: null, tplAction, library: libCtx?.library, fields: libFields })
          })
          setPendingLibAction(null)

          if (!confirmed) {
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: '用户取消了该操作。' })
            continue
          }
          try {
            const { result, undo } = await executeTplAction(tplAction)
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
            if (undo) {
              setMessages((m) => {
                let attached = false
                return m.map((msg) => {
                  if (!attached && msg.role === 'assistant' && !msg.pending) {
                    attached = true
                    return { ...msg, undo }
                  }
                  return msg
                })
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
    // 达到 5 轮上限后，清理最后一条 pending 消息
    setMessages((m) =>
      m.map((msg, i) =>
        i === m.length - 1 && msg.pending
          ? { ...msg, pending: false, content: msg.content || '（已达到工具调用最大轮数）' }
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
    if (action.action === 'delete') {
      if (!action.itemId) return { result: '缺少条目 ID' }
      await getProvider().deleteItem(action.itemId)
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
    await getProvider().updateItem(updated)
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
      const id = await createLibrary(action.name, action.category || '默认')
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
    confirmResolver?.(pendingAction.action)
    confirmResolver = null
  }
  const handleCancelAction = () => {
    confirmResolver?.(null)
    confirmResolver = null
    setPendingAction(null)
  }
  const handleConfirmLibAction = async () => {
    libConfirmResolver?.(true)
    libConfirmResolver = null
  }
  const handleCancelLibAction = () => {
    libConfirmResolver?.(false)
    libConfirmResolver = null
    setPendingLibAction(null)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleClear = () => {
    setMessages([])
  }

  const handleUndo = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex]
    if (!msg?.undo) return
    try {
      await msg.undo.undo()
      // 移除 undo 信息，标记已撤回
      setMessages((m) =>
        m.map((mm, i) =>
          i === msgIndex
            ? { ...mm, undo: undefined, content: mm.content + '\n\n（已撤回）' }
            : mm,
        ),
      )
      message.success('已撤回操作')
    } catch (e) {
      message.error(`撤回失败：${(e as Error).message}`)
    }
  }, [messages, message])

  // 渲染消息内容：把 (id=xxx) 转成可点击 chip
  const renderContent = (text: string, contexts: LibraryContext[] | null) => {
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
                color="blue"
                style={{ cursor: 'pointer', margin: '0 2px' }}
                onClick={() => locateAndFocus(itemId, contexts).catch((e) => message.error('定位条目失败：' + (e as Error).message))}
              >
                {summary.slice(0, 12) || itemId.slice(0, 6)}
              </Tag>
            </Tooltip>
          )
        }
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
          description="尚未配置 AI"
        >
          <Text type="secondary">请到「设置 → AI 配置」填写服务商地址、API Key 与模型名。</Text>
        </Empty>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>作用域:</Text>
        <Select
          size="small"
          value={scope}
          onChange={(v) => setScope(v)}
          style={{ flex: 1 }}
          options={[
            { label: '当前管理库', value: 'current' },
            { label: '全部管理库', value: 'all' },
          ]}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={handleClear} type="text" />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {messages.length === 0 ? (
          <Empty
            image={false}
            description={
              <span style={{ color: '#999' }}>
                问点什么吧，例如「统计每个分类的条目数」或「新增一条姓名=测试的记录」
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
                  background: m.role === 'user' ? '#1677ff' : '#f0f0f0',
                  color: m.role === 'user' ? '#fff' : '#666',
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
                  background: m.role === 'user' ? '#1677ff' : '#f5f5f5',
                  color: m.role === 'user' ? '#fff' : '#333',
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
                      label: <span style={{ fontSize: 12, color: '#999' }}>思考过程</span>,
                      children: (
                        <pre style={{ margin: 0, fontSize: 12, color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.thinking}
                        </pre>
                      ),
                    }]}
                  />
                )}
                {m.pending && !m.content ? <Spin size="small" /> : renderContent(m.content, lastContextsRef.current)}
                {/* 撤回按钮 */}
                {m.undo && (
                  <Button
                    size="small"
                    type="link"
                    icon={<UndoOutlined />}
                    onClick={() => handleUndo(i)}
                    style={{ marginTop: 4, padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    撤回{m.undo.label}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder="输入问题或指令…"
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim()}
          />
        </Space.Compact>
        {loading && (
          <Button size="small" type="link" onClick={handleStop} style={{ marginTop: 4 }}>
            停止生成
          </Button>
        )}
      </div>

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
  )
}
