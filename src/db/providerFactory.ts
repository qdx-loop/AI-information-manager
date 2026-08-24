import type { DataProvider } from "@/types/dataProvider"
import type { Settings } from "@/types"
import { LocalDataProvider } from "./localProvider"
import { SupabaseDataProvider } from "./supabaseProvider"

let current: DataProvider | null = null

export function getProvider(): DataProvider {
  if (!current) current = new LocalDataProvider()
  return current
}

export function setProvider(p: DataProvider): void {
  current = p
}

export function resetProvider(): void {
  current = null
}

export function initFromSettings(settings: Settings): DataProvider {
  if (settings.storageMode === "cloud" && settings.cloud.url && settings.cloud.anonKey) {
    current = new SupabaseDataProvider(settings.cloud.url, settings.cloud.anonKey)
  } else {
    current = new LocalDataProvider()
  }
  return current
}
