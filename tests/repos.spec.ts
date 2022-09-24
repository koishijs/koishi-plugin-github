import { App, Random } from 'koishi'
import { expect, use } from 'chai'
import { oauth, api, mockResponse } from './utils'
import * as jest from 'jest-mock'
import * as github from '../src'
import * as help from '@koishijs/plugin-help'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import shape from 'chai-shape'
import promise from 'chai-as-promised'

use(shape)
use(promise)

const app = new App()

app.plugin(help)
app.plugin(memory)
app.plugin(mock)
app.plugin(github)

const client = app.mock.client('123', '999')
const client2 = app.mock.client('123')
const client3 = app.mock.client('456', '999')

const messageId = '1145141919810'
const accessToken = '114514'
const refreshToken = '1919810'
const payload = {
  access_token: accessToken,
  refresh_token: refreshToken,
}

describe('koishi-plugin-github (repos)', () => {
  before(async () => {
    await app.start()
    await app.mock.initUser('123', 3)
    await app.mock.initUser('456', 3)
    await app.mock.initChannel('999', app.bots[0].selfId, {
      github: {
        webhooks: { 'koishijs/koishi': {} },
      },
    })
    app.github!.history[messageId] = {
      reply: [`https://api.github.com/repos/koishijs/koishi/issues/19/comments`],
    }
  })
  
  after(() => app.stop())

  it('authorize server', async () => {
    await expect(app.mock.webhook.get('/github/authorize')).to.eventually.have.property('code', 400)
    await expect(app.mock.webhook.get('/github/authorize?state=123')).to.eventually.have.property('code', 403)
    await expect(app.mock.webhook.get('/github/authorize?state=123&state=456')).to.eventually.have.property('code', 400)
  })

  it('webhook server', async () => {
    await expect(app.mock.webhook.post('/github/webhook', {})).to.eventually.have.property('code', 400)
  })

  it('github.authorize', async () => {
    const uuid = jest.spyOn(Random, 'id')
    uuid.mockReturnValue('foo-bar-baz')
    oauth().query({ state: 'foo-bar-baz' }).reply(200, payload)
    await client.shouldReply('github.authorize', '请输入用户名。')
    await client.shouldReply('github.authorize satori', /^请点击下面的链接继续操作：/)
    await expect(app.mock.webhook.get('/github/authorize')).to.eventually.have.property('code', 400)
    await expect(app.mock.webhook.get('/github/authorize?state=foo-bar-baz')).to.eventually.have.property('code', 200)
    await expect(app.database.getUser('mock', '123')).to.eventually.have.shape({
      github: { accessToken, refreshToken },
    })
    uuid.mockRestore()
  })

  it('github.repos (handle errors)', async () => {
    await client.shouldReply('github.repos', '当前没有监听的仓库。')
    await client.shouldReply('github.repos -d', '请输入仓库名。')
    await client.shouldReply('github.repos -d foo', '请输入正确的仓库名。')

    api.post('/repos/foo/bar/hooks').reply(404)
    await client.shouldReply('github.repos -a foo/bar', '仓库不存在或您无权访问。')
    api.post('/repos/foo/bar/hooks').reply(403)
    await client.shouldReply('github.repos -a foo/bar', '第三方访问受限，请尝试授权此应用。\nhttps://docs.github.com/articles/restricting-access-to-your-organization-s-data/')
    api.post('/repos/foo/bar/hooks').reply(500)
    await client.shouldReply('github.repos -a foo/bar', '由于未知原因添加仓库失败。')
  })

  it('github (check context)', async () => {
    await client2.shouldReply('github', /^github <user>\nGitHub 相关功能/)
    await client2.shouldReply('github -l', '当前不是群聊上下文。')
    await client2.shouldReply('github -a foo/bar', '当前不是群聊上下文。')
    await client.shouldReply('github -l', 'koishijs/koishi')
  })

  it('github (auto create)', async () => {
    await client.shouldReply('github -a', '请输入仓库名。')
    await client.shouldReply('github -a foo', '请输入正确的仓库名。')
    await client.shouldReply('github -a koishijs/koishi', '已经在当前频道订阅过仓库 koishijs/koishi。')
    await client.shouldReply('github -a foo/bar', '尚未添加过仓库 foo/bar。发送空行或句号以立即添加并订阅该仓库。')
    api.post('/repos/foo/bar/hooks').reply(200, { id: 999 })
    await client.shouldReply('.', '添加订阅成功！')
    await client.shouldReply('github.repos -a foo/bar', '已经添加过仓库 foo/bar。')
  })

  it('github (unsubscribe repo)', async () => {
    await client.shouldReply('github -d foo/bar', '移除订阅成功！')
    await client.shouldReply('github -d foo/bar', '尚未在当前频道订阅过仓库 foo/bar。')
  })

  it('github.repos (remove repo)', async () => {
    api.delete('/repos/foo/bar/hooks/999').reply(403)
    await client.shouldReply('github.repos -d foo/bar', '由于未知原因移除仓库失败。')
    api.delete('/repos/foo/bar/hooks/999').reply(200)
    await client.shouldReply('github.repos -d foo/bar', '移除仓库成功！')
    await client.shouldReply('github.repos -d foo/bar', '尚未添加过仓库 foo/bar。')
  })

  it('github.repos (add repo)', async () => {
    await client.shouldReply('github.repos', '当前没有监听的仓库。')
    api.post('/repos/koishijs/koishi/hooks').reply(200, { id: 999 })
    await client.shouldReply('github.repos -a koishijs/koishi', '添加仓库成功！')
    await client.shouldReply('github.repos', 'koishijs/koishi')
  })

  it('github.issue', async () => {
    await client.shouldReply('github.issue', '请输入仓库名。')
    await client.shouldReply('github.issue -r foo', '请输入正确的仓库名。')
    api.post('/repos/koishijs/koishi/issues').reply(200)
    await client.shouldReply('github.issue -r koishijs/koishi foo bar', '创建成功！')
  })

  it('github.star', async () => {
    await client.shouldReply('github.star', '请输入仓库名。')
    await client.shouldReply('github.star -r foo', '请输入正确的仓库名。')
    api.put('/user/starred/koishijs/koishi').reply(200)
    await client.shouldReply('github.star -r koishijs/koishi', '操作成功！')
  })

  it('token not found', async () => {
    await client3.shouldReply(`<quote id=${messageId}/> test`, '要使用此功能，请对机器人进行授权。输入你的 GitHub 用户名。')
    const uuid = jest.spyOn(Random, 'id')
    uuid.mockReturnValue('foo-bar-baz')
    await client3.shouldReply('satori', /^请点击下面的链接继续操作：/)
    uuid.mockRestore()
  })

  it('request error', async () => {
    api.post('/repos/koishijs/koishi/issues/19/comments').replyWithError('foo')
    await client.shouldReply(`<quote id=${messageId}/> test`, '发送失败。')
  })

  it('refresh token', async () => {
    const response = mockResponse('POST', '/issues/19/comments', [401])
    oauth().reply(401)
    await client.shouldReply(`<quote id=${messageId}/> test`, '令牌已失效，需要重新授权。输入你的 GitHub 用户名。')
    expect(response.mock.calls).to.have.length(1)
    await client.shouldReply('', '输入超时。')
  })

  it('reauthorize', async () => {
    const response1 = mockResponse('POST', '/issues/19/comments', [401])
    const response2 = mockResponse('POST', '/issues/19/comments', [500])
    oauth().query({ refresh_token: '1919810', grant_type: 'refresh_token' }).reply(200, payload)
    await client.shouldReply(`<quote id=${messageId}/> test`, '发送失败。')
    expect(response1.mock.calls).to.have.length(1)
    expect(response2.mock.calls).to.have.length(1)
  })
})
