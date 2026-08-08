import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// 如果环境变量未指定，默认使用你的 GitHub Pages 地址
const site =
  process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://justincnn.github.io";
const base = process.env.BASE_PATH || "/notes-for-myself"; // 👈 GitHub Pages 子路径（前后需带斜杠；绑定自定义域名后设为 "/"）

export default defineConfig({
  site,
  base,
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});