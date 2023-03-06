import { md } from 'koishi-plugin-markdown'

export const INDICATOR = '<!-- BOT-MESSAGE-FOOTER -->'

export function transform(source: string) {
  if (!source) return ''
  const index = source.indexOf(INDICATOR)
  if (index >= 0) source = source.slice(0, index)
  source = source.replace(/^<!--(.*)-->$/gm, '')
  return md(source).join('').trim().replace(/\n\s*\n/g, '\n')
}
