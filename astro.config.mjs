import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// 如果环境变量未指定，默认使用你的 GitHub Pages 地址
const site =
  process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://justincnn.github.io";

export default defineConfig({
  site,
  base: "/notes-for-myself", // 👈 关键：添加仓库子路径（前后需带斜杠）
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});