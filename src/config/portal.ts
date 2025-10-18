export type Portal = {
  title: string;
  description: string;
  href: string;
  image: string;
};

export const portal: Portal[] = [
  {
    title: "Portfolio / CV Website",
    description: "My personal portfolio and CV website.",
    href: "https://vukosi.coraxi.com/",
    image: "images/portfolio.png",
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
];
