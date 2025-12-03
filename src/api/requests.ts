import type { LabeledItem } from '@/types/LabeledItem'
import { apiFetch } from './client'

export async function getSymbols(): Promise<LabeledItem[]> {
  return apiFetch<LabeledItem[]>('/symbols')
}

export async function getStrategies(): Promise<LabeledItem[]> {
  return apiFetch<LabeledItem[]>('/strategies')
}
