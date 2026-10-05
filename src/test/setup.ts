import '@testing-library/jest-dom'

// jsdom 没有 matchMedia，antd 的响应式 Grid / Modal 在渲染时会调它。
// 缺这个桩会抛 "window.matchMedia is not a function"，
// 让「组件渲染」类测试因为无关原因失败。
// 注意要先判 typeof window：个别测试文件用 @vitest-environment node，
// 那里根本没有 window，直接访问会报 ReferenceError。
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
