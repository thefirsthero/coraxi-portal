export const defaultPortals = [
  {
    title: "Portfolio Website",
    description: "My personal portfolio and CV website.",
    href: "https://vukosi.coraxi.com/",
    image: "/images/portfolio.png",
  },
  {
    title: "Calchub",
    description: "A collection of various useful calculators.",
    href: "https://calchub.coraxi.com/",
    image: "/images/calchub.png",
  },
  {
    title: "Confessions",
    description: "A place to share your confessions anonymously.",
    href: "https://confess.coraxi.com/",
    image: "/images/confessions.png",
  },
  {
    title: "Couples Games",
    description: "A collection of games for couples (or any 2 people).",
    href: "https://games.coraxi.com/",
    image: "/images/couples-games.png",
  },
  {
    title: "Pomodoro Focus",
    description: "A simple Pomodoro timer to boost your productivity.",
    href: "https://pomodoro.coraxi.com/",
    image: "/images/pomodoro.png",
  },
  {
    title: "Investment Portfolio Tracker",
    description: "My personal investment portfolio tracker.",
    href: "https://portfolio.coraxi.com/",
    image: "/images/portfolio-tracker.png",
  },
  {
    title: "Bucket List",
    description: "My bucket list.",
    href: "https://bucket.coraxi.com/",
    image: "/images/bucket-list.png",
  },
  {
    title: "Bento PDF",
    description: "Fast PDF tools for merging, splitting, and organizing documents.",
    href: "https://pdf.coraxi.com/",
    image: "/images/bento-pdf.svg",
  },
  {
    title: "ConvertX",
    description: "A versatile file converter for documents, media, and more.",
    href: "https://convertx.coraxi.com/",
    image: "/images/convertx.svg",
  },
  {
    title: "Budget Tracker",
    description: "Track spending, plan budgets, and monitor your financial goals.",
    href: "https://budget.coraxi.com/",
    image: "/images/budget-tracker.svg",
  },
  {
    title: "Karakeep",
    description: "Save websites and bookmarks to revisit and organize later.",
    href: "https://karakeep.coraxi.com/",
    image: "/images/karakeep.svg",
  },
  {
    title: "Linkstack",
    description: "A Linktree-style page to share all your important links.",
    href: "https://linkstack.coraxi.com/",
    image: "/images/linkstack.svg",
  },
  {
    title: "MeTube",
    description: "A simple YouTube downloader interface for quick saves.",
    href: "https://metube.coraxi.com/",
    image: "/images/metube.svg",
  },
  {
    title: "PairDrop",
    description: "Instantly share files between nearby devices in your browser.",
    href: "https://pairdrop.coraxi.com/",
    image: "/images/pairdrop.svg",
  },
];

function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getFallbackImageFromHref(href) {
  try {
    const parsed = new URL(href);
    return `https://icons.duckduckgo.com/ip3/${parsed.hostname}.ico`;
  } catch {
    return "https://www.google.com/s2/favicons?domain=example.com&sz=128";
  }
}

export function resolvePortalImage(image, href) {
  const imageValue = typeof image === "string" ? image.trim() : "";

  if (isAbsoluteHttpUrl(imageValue)) {
    return imageValue;
  }

  return getFallbackImageFromHref(href);
}
