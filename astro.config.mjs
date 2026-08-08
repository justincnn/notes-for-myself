import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import remarkBlobImages from "./src/lib/remark-blob-images.js";

// 如果环境变量未指定，默认使用你的自定义域名
const site =
  process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://blog.go2pixel.com";
const base = process.env.BASE_PATH || "/"; // 自定义域名部署在根路径，base 为 "/"

export default defineConfig({
  site,
  base,
  markdown: {
    remarkPlugins: [remarkBlobImages],
  },
  integrations: [mdx({ remarkPlugins: [remarkBlobImages] })],
  vite: {
    plugins: [tailwindcss()],
  },
});