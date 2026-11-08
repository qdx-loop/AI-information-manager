import { describe, it, expect } from 'vitest'
import { parseCSV } from './csv'

// 回归：我们导出的 CSV 带 UTF-8 BOM（防 Excel 中文乱码），导入时必须剥掉，
// 否则第一列表头会变成 "\uFEFF姓名"，自动匹配失败、用户以为导入坏了。
describe('CSV 导入：BOM 与表头空格', () => {
  it('剥掉 BOM 并 trim 表头', async () => {
    const file = new File(['\uFEFF 姓名 , 公司 \n张三,华为'], 'a.csv', { type: 'text/csv' })
    const rows = await parseCSV(file)
    expect(Object.keys(rows[0])).toEqual(['姓名', '公司'])
    expect(rows[0]['姓名']).toBe('张三')
  })
})
