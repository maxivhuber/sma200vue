import { apiFetch } from './client'

export async function getSymbols(): Promise<string[]> {
  return apiFetch<string[]>('/symbols')
}

export async function getStrategies(): Promise<string[]> {
  return apiFetch<string[]>('/strategies')
}
