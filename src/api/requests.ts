import { apiFetch } from './client'

export async function getSymbols(): Promise<string[]> {
  return apiFetch<string[]>('/symbols')
}
