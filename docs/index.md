# 介绍

::: tip
要使用本插件，你需要安装数据库支持。
:::

::: tip
要启用屏幕截图相关功能，你需要安装 koishi-plugin-puppeteer。
:::

koishi-plugin-github 封装了一系列 GitHub 相关的功能。比如监听 [GitHub Webhooks](https://developer.github.com/webhooks/)，将收到的事件进行处理后发送到特定频道中。你还可以直接回复某条推送，通过快捷指令来实现进一步的功能，例如查看链接、进行评论、合并 PR 等等。

## 功能展示

<!-- ### 收取 Github Webhooks

下面是一个 push 的例子，并使用 link 快捷指令来查看 diff。

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>[GitHub] Shigma pushed to koishijs/koishi:develop</p>
<p>[d7ff34] chore: adjust</p>
<p>[3ae7e7] fix(core): create major context at demand</p>
</chat-message>
<chat-message nickname="Alice" color="#cc0066">
<blockquote>
<p>[GitHub] Shigma pushed to koishijs/koishi:develop</p>
<p>[d7ff34] chore: adjust</p>
<p>[3ae7e7] fix(core): create major context at demand</p>
</blockquote>
<p>.link</p>
</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">https://github.com/koishijs/koishi/compare/976c6e8f09a4...3ae7e7044d06</chat-message>
</panel-view>

下面是一个 issue 的例子，并通过回复的方式来实现在 GitHub 中的回复。

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>[GitHub] simon300000 opened an issue koishijs/koishi#19</p>
<p>Title: Wie kann man um das Koishi zu installieren?</p>
<p>Ich verstecke Englisch und Chinesisch nicht! Gab es Personen, die mir helfen kann?</p>
</chat-message>
<chat-message nickname="Alice" color="#cc0066">
<blockquote>
<p>[GitHub] simon300000 opened an issue koishijs/koishi#19</p>
<p>Title: Wie kann man um das Koishi zu installieren?</p>
<p>Ich verstecke Englisch und Chinesisch nicht! Gab es Personen, die mir helfen kann?</p>
</blockquote>
<p>Mich würde auch interessieren, was ist „CoolQ“?</p>
</chat-message>
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>[GitHub] simon300000 commented on issue koishijs/koishi#19</p>
<p>Mich würde auch interessieren, was ist „CoolQ“?</p>
</chat-message>
</panel-view> -->

## 基本用法

### 将 Bot 部署在公网

1. 本插件的监听功能基于github webhook运行，因此需要部署于公网（参考[服务器部署](https://koishi.chat/manual/recipe/server.html)）

2. 部署完成后需要填写koishi的 `selfUrl` 字段（可于 控制台 -> 插件配置 -> 全局设置 -> 网络设置 填写）

### 创建你的 OAuth App

1. 访问你个人的 Settings → Developer Settings → OAuth Apps 页面，点击右上角的「New OAuth App」。

![oauth-app-1](./assets/oauth-app-1.png)

2. 上面的两个随便填就可以，下面的 Callback URL 填写你机器人收取验证的地址。若配置项中的`path`未修改，则为机器人部署url加上 `/github/authorize`, 其中`/github`为配置项中`path`。配置完毕后点击「Register Application」就可以使用了。

> 例如机器人部署在`https://example.com`，配置项中为`path`为默认值`/github`，`callback URL`则填写`https://example.com/github/authorize`


![oauth-app-2](./assets/oauth-app-2.png)

### 填写插件的配置项

```yaml
plugins:
  github:
    appId: your-oauth-app-client-id
    appSecret: your-oauth-app-client-secret
```

### 其他注意事项

部分功能（如仓库订阅）需要用户具有较高级权限才可以设置。出现相关问题时可以通过调整用户权限解决。（如编辑控制台 -> 数据库 -> User 的authority权限）

## 指令：github

## 指令：github.repos

## 指令：github.authorize
