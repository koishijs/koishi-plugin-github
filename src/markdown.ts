import { segment } from 'koishi'
import { marked } from 'marked'

declare module 'marked' {
  namespace Tokens {
    interface Def {
      type: 'def'
    }

    interface Paragraph {
      tokens: marked.Token[]
    }
  }
}

function renderToken(token: marked.Token) {
  if (token.type === 'code') {
    return token.text + '\n'
  } else if (token.type === 'paragraph') {
    return render(token.tokens)
  } else if (token.type === 'image') {
    return segment.image(token.href)
  } else if (token.type === 'blockquote') {
    return token.text
  }
  return token.raw
}

function render(tokens: marked.Token[]) {
  return tokens.map(renderToken).join('')
}

export const INDICATOR = '<!-- BOT-MESSAGE-FOOTER -->'

export function transform(source: string) {
  if (!source) return ''
  const index = source.indexOf(INDICATOR)
  if (index >= 0) source = source.slice(0, index)
  source = source.replace(/^<!--(.*)-->$/gm, '')
  return render(marked.lexer(source)).trim().replace(/\n\s*\n/g, '\n')
}
