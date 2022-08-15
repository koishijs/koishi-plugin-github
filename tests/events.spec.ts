import { App, Bot, Random, sleep } from 'koishi'
import { expect } from 'chai'
import { readdirSync } from 'fs'
import { resolve } from 'path'
import { mockResponse } from './utils'
import * as jest from 'jest-mock'
import * as github from '../src'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'

const app = new App({
  prefix: '.',
})

app.plugin(memory)
app.plugin(mock)

const client = app.mock.client('123', '999')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 3, {
    github: {
      accessToken: '114514',
      refreshToken: '1919810',
    },
  })
  await app.database.createChannel('mock', '999', {
    assignee: app.bots[0].selfId,
    githubWebhooks: { 'koishijs/koishi': {} },
  })
  app.plugin(github)
  await sleep(0)
})

const snapshot = require('./index.snap')

describe('koishi-plugin-github (events)', () => {
  const idMap: Record<string, string> = {}

  describe('Webhook Events', () => {
    // spy on sendMessage
    const sendMessage = app.bots[0].sendMessage = jest.fn<Bot['sendMessage']>()

    const files = readdirSync(resolve(__dirname, 'fixtures'))
    files.forEach((file) => {
      const title = file.slice(0, -5)
      it(title, async () => {
        sendMessage.mockClear()
        sendMessage.mockImplementation(() => {
          return Promise.resolve([idMap[title] = Random.id()])
        })

        const payload = require(`./fixtures/${title}`)
        const [event] = title.split('.', 1)
        const fullEvent = payload.action ? `${event}/${payload.action}` : event
        if (payload.action) {
          app.emit(`github/${fullEvent}` as any, payload)
        }
        app.emit(`github/${event}` as any, payload)

        // wait until all messages are sent
        await sleep(0)
        if (snapshot[title]) {
          expect(sendMessage.mock.calls).to.have.length(1)
          expect(sendMessage.mock.calls[0][1]).to.equal(snapshot[title].trim())
        } else {
          expect(sendMessage.mock.calls).to.have.length(0)
        }
      })
    })
  })

  describe('Quick Interactions', () => {
    it('no operation', async () => {
      await client.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}]`)
      await client.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] .noop`)
    })

    it('link', async () => {
      await client.shouldReply(
        `[CQ:quote,id=${idMap['issue_comment.created.1']}] .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    it('react', async () => {
      const reaction = mockResponse('POST', '/issues/comments/576277946/reactions', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] laugh`)
      expect(reaction.mock.calls).to.have.length(1)
    })

    it('reply', async () => {
      const comment = mockResponse('POST', '/issues/19/comments', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['issue_comment.created.1']}] test`)
      expect(comment.mock.calls).to.have.length(1)
    })

    it('close', async () => {
      const api1 = mockResponse('PATCH', '/issues/20', [200])
      const api2 = mockResponse('POST', '/issues/20/comments', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .close foo`)
      expect(api1.mock.calls).to.have.length(1)
      expect(api2.mock.calls).to.have.length(1)
    })

    it('base', async () => {
      const api = mockResponse('PATCH', '/pulls/20', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .base foo`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('merge', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .merge`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('rebase', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .rebase`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('squash', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`[CQ:quote,id=${idMap['pull_request.opened.1']}] .squash`)
      expect(api.mock.calls).to.have.length(1)
    })
  })
})
