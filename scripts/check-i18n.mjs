/**
 * 校验 zh / en 两个字典的 key 完全一致。
 *
 * 背景：曾出现中文 key 被插进英文区，结果中文界面直接显示
 * `lib.empty.noFields.ctaWrite` 这种裸 key —— tsc 通过、186 个测试全绿，
 * 只有截图能看出来。所以把它变成一个会失败的检查。
 *
 * 文件里三种写法都要认：
 *   const zh: Dict = { 'k': … }            （字面量块）
 *   Object.assign(zh, { 'k': … })          （增量块，中英文交错出现）
 *   (zh as Dict)['k'] = …                  （单条赋值）
 */
import { readFileSync } from 'node:fs'
const lines = readFileSync(process.argv[2], 'utf8').split('\n')

const zh = new Set()
const en = new Set()
let dict = null   // 'zh' | 'en'：处于 const X: Dict = { … } 块内
let assign = null // 'zh' | 'en'：处于 Object.assign(X, { … }) 块内

for (const raw of lines) {
  const line = raw.trim()

  const mDict = /^const (zh|en): Dict = \{/.exec(line)
  if (mDict) { dict = mDict[1]; assign = null; continue }
  const mAssign = /^Object\.assign\((zh|en)\b/.exec(line)
  if (mAssign) { assign = mAssign[1]; dict = null; continue }
  const mBracket = /^\(?(zh|en) as Dict\)?\s*\[\s*'([^']+)'\s*\]\s*=/.exec(line)
  if (mBracket) { (mBracket[1] === 'zh' ? zh : en).add(mBracket[2]); continue }

  // 块结束：const X = { … } 收尾是裸 }，Object.assign(…) 收尾是 })
  if (/^\}\)?$/.test(line) || /^\}\);?$/.test(line)) { dict = null; assign = null; continue }

  const mKey = /^'([^']+)':/.exec(line)
  if (mKey) {
    const target = dict ?? assign
    if (target === 'en') en.add(mKey[1])
    else if (target === 'zh') zh.add(mKey[1])
  }
}

console.log(`zh=${zh.size} en=${en.size}`)
const zhOnly = [...zh].filter((k) => !en.has(k)).sort()
const enOnly = [...en].filter((k) => !zh.has(k)).sort()
if (zhOnly.length) console.log('ZH_ONLY (中文界面显示裸 key):', zhOnly.join(', '))
if (enOnly.length) console.log('EN_ONLY (英文界面显示裸 key):', enOnly.join(', '))
process.exit(zhOnly.length || enOnly.length ? 1 : 0)
