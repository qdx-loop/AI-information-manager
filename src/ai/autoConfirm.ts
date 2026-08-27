import { createContext, useContext } from 'react'

interface AutoConfirmState {
  alwaysAllowFor: Set<string>
  setAlwaysAllowFor: (k: string) => void
}

export const AutoConfirmContext = createContext<AutoConfirmState>({
  alwaysAllowFor: new Set(),
  setAlwaysAllowFor: () => {},
})

export function useAutoConfirm() {
  return useContext(AutoConfirmContext)
}
