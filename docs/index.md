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

### 创建你的 OAuth App

1. 访问你个人的 Settings → Developer Settings → OAuth Apps 页面，点击右上角的「New OAuth App」。

![oauth-app-1](./assets/oauth-app-1.png)

1. 上面的两个随便填就可以，下面的 Callback URL 填写你机器人收取验证的地址（通常是你机器人的域名加上 `/github/authorize`）。配置完毕后点击「Register Application」就可以使用了。

![oauth-app-2](./assets/oauth-app-2.png)

### 填写插件的配置项

```yaml
plugins:
  github:
    appId: your-github-app-id
    appSecret: your-github-app-secret
```

同时，你也需要填写 `全局设置` 中的 `selfUrl` 项，以便于 Koishi 知晓你的 bot 的公网地址。

另外， `appId` 和 `appSecret` 是你看到的 `clientId` 和 `clientSecret` ，~~我很怀疑是打错了~~。

## 指令：github

github [name]
可用的选项有：
    -a, --add 在该群聊订阅一个已监听的仓库
    -d, --delete 移除已订阅的仓库
    -l, --list 列出本群监听的仓库 

## 指令：github.repos

github.repos [name]
管理监听的仓库
可用的选项有：
    -a, --add  监听一个新的仓库
    -d, --delete  移除已监听的仓库
    -s, --subscribe  添加完成后更新到订阅

在添加好监听后，你可以在群聊上下文中使用 `github -a [仓库名]` 来监听某个仓库。这需要操作者拥有 Bot 的 2 级权限。

## 指令：github.authorize

github.authorize <user>
GitHub 授权
别名：github.auth。
