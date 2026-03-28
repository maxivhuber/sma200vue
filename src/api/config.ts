const isDev = import.meta.env.DEV

export const API_CONFIG = {
  baseURL: isDev ? '/api/' : 'https://invest.mhuber.dev/api/',
}

export const WS_CONFIG = {
  baseURL: isDev
    ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/`
    : 'https://invest.mhuber.dev/ws/',
}
