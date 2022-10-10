import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'koishi-plugin-github',
  description: 'GitHub Toolkit for Koishi',
  themeConfig: {
    outline: [2, 3],
    sidebar: [{
      text: '指南',
      items: [
        { text: '介绍', link: './' },
        { text: '配置项', link: './config' },
      ],
    }],
  },
  vite: {
    resolve: {
      dedupe: ['vue'],
    },
  },
})
