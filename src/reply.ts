import { Dict, Logger, Quester, h } from 'koishi'
import { INDICATOR } from './markdown'
import GitHub, { ReplySession } from '.'

export type ReplyPayloads = {
  [K in keyof ReplyHandler]?: ReplyHandler[K] extends (...args: infer P) => any ? P : never
}

export type EventData<T = {}> = [string, (ReplyPayloads & T)?]

export class ReplyHandler {
  constructor(public github: GitHub, public session: ReplySession, public content?: string) {}

  async request(method: Quester.Method, url: string, message: string, body?: any, headers?: Dict) {
    try {
      await this.github.request(method, url, this.session, body, headers)
    } catch (err) {
      if (!Quester.isAxiosError(err)) throw err
      this.github['logger'].warn(err)
      return message
    }
  }

  link(url: string) {
    return url
  }

  react(url: string) {
    return this.request('POST', url, this.session.text('github.send-failed'), {
      content: this.content,
    }, {
      accept: 'application/vnd.github.squirrel-girl-preview',
    })
  }

  async transform(source: string) {
    if (this.github.ctx.assets) {
      source = await this.github.ctx.assets.transform(source)
    }
    return [
      h.transform(source, {
        text: ({ content }) => content,
        image: ({ url }) => `![image](${url})`,
        default: false,
      }),
      INDICATOR,
      this.github.config.replyFooter,
    ].join('\n')
  }

  async reply(url: string, params?: Dict) {
    return this.request('POST', url, this.session.text('github.send-failed'), {
      body: await this.transform(this.content),
      ...params,
    })
  }

  base(url: string) {
    return this.request('PATCH', url, this.session.text('github.modify-failed'), {
      base: this.content,
    })
  }

  merge(url: string, method?: 'merge' | 'squash' | 'rebase') {
    const [title] = this.content.split('\n', 1)
    const message = this.content.slice(title.length)
    return this.request('PUT', url, this.session.text('github.action-failed'), {
      merge_method: method,
      commit_title: title.trim(),
      commit_message: message.trim(),
    })
  }

  rebase(url: string) {
    return this.merge(url, 'rebase')
  }

  squash(url: string) {
    return this.merge(url, 'squash')
  }

  async close(url: string, commentUrl: string) {
    if (this.content) await this.reply(commentUrl)
    await this.request('PATCH', url, this.session.text('github.action-failed'), {
      state: 'closed',
    })
  }

  async shot(url: string, selector: string, padding: number[] = []) {
    const page = await this.session.app.puppeteer.page()
    let buffer: Buffer
    try {
      await page.goto(url)
      const el = await page.$(selector)
      const clip = await el.boundingBox()
      const [top = 0, right = 0, bottom = 0, left = 0] = padding
      clip.x -= left
      clip.y -= top
      clip.width += left + right
      clip.height += top + bottom
      buffer = await page.screenshot({ clip })
    } catch (error) {
      new Logger('puppeteer').warn(error)
      return this.session.text('github.screenshot-failed')
    } finally {
      await page.close()
    }
    return h.image(buffer, 'image/png')
  }
}
