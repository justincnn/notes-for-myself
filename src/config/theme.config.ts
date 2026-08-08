const siteUrl = (
  import.meta.env.SITE_URL ||
  import.meta.env.PUBLIC_SITE_URL ||
  "https://justincnn.github.io"
).replace(/\/$/, "");

export const SITE = {
  name: "The Liberal Arts Guide to IT",
  description:
    "A personal hobby blog collecting and organizing notes on software, systems, and AI. Written by a curious hobbyist, not an expert.",
  url: siteUrl,
  locale: "en-US",
  language: "en",
  repositoryUrl: "https://github.com/justincnn/notes-for-myself",
};

export const NAVIGATION = [
  { to: "/", label: "Home" },
  { to: "/blog", label: "Blog" },
  {
    to: "https://app.pagescms.org/justincnn/notes-for-myself/main/collection/posts",
    label: "Writing",
  },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const CONTACT = {
  email: "hello@example.com",
  socialHandle: "@quietpages",
  socialUrl: "https://x.com/quietpages",
};

export const FORMS = {
  contact: {
    action: "",
    method: "post",
    enctype: "application/x-www-form-urlencoded",
  },
  newsletter: {
    action: "",
    method: "post",
    enctype: "application/x-www-form-urlencoded",
  },
};

export const SOCIAL_LINKS = [
  { href: "/rss.xml", label: "RSS feed", icon: "rss" },
  { href: CONTACT.socialUrl, label: `${SITE.name} on X`, icon: "twitter" },
  { href: SITE.repositoryUrl, label: `${SITE.name} on GitHub`, icon: "github" },
  { href: `mailto:${CONTACT.email}`, label: "Email", icon: "mail" },
];

export const authors = [];

export const categories = [];

export const tags = [];
