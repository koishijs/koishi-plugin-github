import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'koishi-plugin-github',
  description: 'GitHub Toolkit for Koishi',
  themeConfig: {
    outline: [2, 3],
  },
  vite: {
    resolve: {
      dedupe: ['vue'],
    },
  },
})
