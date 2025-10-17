export type Portal = {
  title: string;
  description: string;
  href: string;
  image: string;
};

export const portal: Portal[] = [
  {
    title: "Shadcn UI",
    description: "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.",
    href: "https://ui.shadcn.com/",
    image: "/avatars/shadcn.jpg",
  },
  {
    title: "Coraxi",
    description: "A collection of open-source projects.",
    href: "https://coraxi.org/",
    image: "https://avatars.githubusercontent.com/u/6924319?s=200&v=4",
  },
];
