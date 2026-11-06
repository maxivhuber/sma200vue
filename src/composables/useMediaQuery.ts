import { onScopeDispose, readonly, shallowRef } from 'vue'

/** Keep in sync with the `@media` breakpoint in `assets/main.css`. */
export const MOBILE_QUERY = '(max-width: 768px)'

export function useMediaQuery(query: string) {
  const mql = window.matchMedia(query)
  const matches = shallowRef(mql.matches)

  const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches)
  mql.addEventListener('change', onChange)
  onScopeDispose(() => mql.removeEventListener('change', onChange))

  return readonly(matches)
}
