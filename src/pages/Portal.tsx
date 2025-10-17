import { portal } from "@/config/portal";
import { cn } from "@/lib/utils";

const colors = [
  {
    bg: "bg-red-500/10",
    border: "border-red-500",
  },
  {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500",
  },
  {
    bg: "bg-green-500/10",
    border: "border-green-500",
  },
  {
    bg: "bg-blue-500/10",
    border: "border-blue-500",
  },
  {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500",
  },
  {
    bg: "bg-purple-500/10",
    border: "border-purple-500",
  },
  {
    bg: "bg-pink-500/10",
    border: "border-pink-500",
  },
];

const sizes = [
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
  "col-span-2 row-span-1",
  "col-span-2 row-span-2",
];

const getRandomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

export default function Portal() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-8">
      {portal.map((item) => {
        const color = getRandomItem(colors);
        return (
          <a
            key={item.title}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block p-4 rounded-lg border-2",
              color.bg,
              color.border,
              getRandomItem(sizes)
            )}
          >
            <div className="flex flex-col h-full text-gray-800 dark:text-white">
              <img src={item.image} alt={item.title} className="w-16 h-16 rounded-full mb-4" />
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="text-sm">{item.description}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
