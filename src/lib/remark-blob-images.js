import fs from "node:fs";
import path from "node:path";

const publicDir = () => path.resolve(process.cwd(), "public");

function walk(node, handler) {
  if (!node || typeof node !== "object") return;
  handler(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object" && typeof child.type === "string") {
          walk(child, handler);
        }
      }
    } else if (value && typeof value === "object" && typeof value.type === "string") {
      walk(value, handler);
    }
  }
}

function resolvePublicUrl(fileName) {
  if (!fileName) return null;
  const filePath = path.join(publicDir(), fileName);
  return fs.existsSync(filePath) ? `/${fileName}` : null;
}

export default function remarkBlobImages() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== "image" || typeof node.url !== "string") return;
      if (node.url.startsWith("blob:")) {
        const publicUrl = resolvePublicUrl(node.alt);
        if (publicUrl) {
          node.url = publicUrl;
        } else {
          node.type = "text";
          node.value = node.alt || "image";
          delete node.url;
          delete node.alt;
          delete node.title;
        }
      } else if (node.url.startsWith("[")) {
        const inner = node.url.match(/\]\((https?:\/\/[^)]+)\)/);
        if (inner) node.url = inner[1];
      }
    });
  };
}
