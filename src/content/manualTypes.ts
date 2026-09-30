/**
 * 产品说明书的内容模型。
 *
 * 说明书不是写死在 JSX 里的字符串数组，而是一份结构化文档：
 * 章节 → 小节 → 内容块。这样左侧目录、正文、锚点跳转都能自动生成，
 * 以后加章节只要往数据里追加，不用改渲染代码。
 *
 * 也因此中英文是两份平行的数据（manualZh / manualEn），
 * 而不是把中文塞进组件里再 if 判断 —— 那样英文模式必然漏译。
 */

export type Block =
  /** 段落 */
  | { t: 'p'; text: string }
  /** 无序列表 */
  | { t: 'ul'; items: string[] }
  /** 有序列表（用于「步骤」的行文） */
  | { t: 'ol'; items: string[] }
  /** 分步操作：每步一个标题 + 说明 */
  | { t: 'steps'; items: { title: string; text: string }[] }
  /** 表格：对比类信息用表格最省版面 */
  | { t: 'table'; head: string[]; rows: string[][] }
  /** 提示框：tip 小技巧 / warn 容易踩的坑 / info 需要知道的事 */
  | { t: 'note'; kind: 'tip' | 'warn' | 'info'; title?: string; text: string }
  /** 等宽内容：接口地址、模型名、字段值等不能被自动折行毁掉的 */
  | { t: 'code'; text: string }

export interface Section {
  id: string
  title: string
  blocks: Block[]
}

export interface Chapter {
  id: string
  title: string
  sections: Section[]
}

export interface Manual {
  title: string
  subtitle: string
  chapters: Chapter[]
}
