// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildContext, SYSTEM_PROMPT, SYSTEM_PROMPT_EN, type LibraryContext } from './contextBuilder'
import { FREE_TEXT_KEY } from '@/utils/freeText'
import type { Item, Library, FieldDef } from '@/types'

function lib(over: Partial<Library> = {}): Library {
  return { id: 'L1', accountId: 'a1', name: '速记', category: '', sortOrder: 0, deletedAt: null, parentId: null, updatedAt: 0, ...over }
}
function item(over: Partial<Item> = {}): Item {
  return { id: 'i1', libraryId: 'L1', accountId: 'a1', fields: {}, pinned: false, sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null, ...over }
}
function ctx(c: Partial<LibraryContext> = {}): LibraryContext {
  return { library: lib(), fields: [] as FieldDef[], items: [] as Item[], ...c }
}

/**
 * 零字段速记（__text）必须能被 AI 看到。
 *
 * 起因：零字段库里的速记正文存在保留键 __text 里，而 rowText 只按模板字段取值，
 * 于是这些条目在 AI 眼里全是空行 —— 用户会以为「AI 看不到我记的东西」，
 * 也会让「用 AI 帮我加一条」这个承诺在零字段库上无法成立。
 */
describe('buildContext：零字段速记', () => {
  it('零字段库的速记正文要出现在上下文里', () => {
    const text = buildContext('all', [ctx({ items: [item({ fields: { [FREE_TEXT_KEY]: '周五下午去客户家里看样子' } })] })], null)
    expect(text).toContain('周五下午去客户家里看样子')
  })

  it('有字段时字段值仍要正常出现', () => {
    const f: FieldDef = { id: 'f1', libraryId: 'L1', key: 'k_name', label: '客户名称', type: 'text', options: [], required: false, visible: true, sortOrder: 0 }
    const text = buildContext('all', [ctx({ fields: [f], items: [item({ fields: { k_name: '北京华盛科技' } })] })], null)
    expect(text).toContain('北京华盛科技')
  })

  it('两者共存时都在', () => {
    const f: FieldDef = { id: 'f1', libraryId: 'L1', key: 'k_name', label: '客户名称', type: 'text', options: [], required: false, visible: true, sortOrder: 0 }
    const text = buildContext('all', [ctx({
      fields: [f],
      items: [item({ fields: { [FREE_TEXT_KEY]: '速记内容', k_name: '字段值' } })],
    })], null)
    expect(text).toContain('速记内容')
    expect(text).toContain('字段值')
  })

  it('buildContext 要逐库标出「还没配模板」', () => {
    // 逐库的信号靠 schemaLine 的 (无字段)
    const text = buildContext('all', [ctx({ items: [item()] })], null)
    expect(text).toMatch(/无字段|no fields/i)
  })

  it('系统提示词要告诉模型零字段时该怎么办（否则它只能干瞪眼）', () => {
    for (const p of [SYSTEM_PROMPT, SYSTEM_PROMPT_EN]) {
      expect(p).toContain('__text')
      expect(p).toContain('execute_template_action')
    }
  })

  it('有字段的库不必提 __text（避免误导）', () => {
    const f: FieldDef = { id: 'f1', libraryId: 'L1', key: 'k_name', label: '客户名称', type: 'text', options: [], required: false, visible: true, sortOrder: 0 }
    const text = buildContext('all', [ctx({ fields: [f] })], null)
    expect(text).not.toContain('__text')
  })

  it('没有任何库时给出明确说明而不是空上下文', () => {
    expect(buildContext('all', [], null)).toMatch(/尚未创建|没有任何/)
  })
})