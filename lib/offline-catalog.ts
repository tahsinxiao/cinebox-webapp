/**
 * Offline demo catalog.
 *
 * well-cinebox streams from the MovieBox BFF. When that upstream is
 * unreachable (sandboxed preview, network egress blocked, provider outage) the
 * UI still has to look and behave like the real thing — so we fall back to this
 * bundled metadata set. Every response that uses it is tagged `source: "offline"`
 * and the UI shows an explicit "Offline demo catalog" badge; nothing here is
 * playable.
 */
import type { CatalogItem, CatalogRow } from "./types";

type Seed = [title: string, year: string, type: "movie" | "series", rating: string, genres: string, duration: string, description: string];

const SEEDS: Seed[] = [
  ["Dune: Part Two", "2024", "movie", "8.5", "Sci-Fi,Adventure", "166m", "Paul Atreides unites with the Fremen to wage war against House Harkonnen and take back Arrakis."],
  ["Oppenheimer", "2023", "movie", "8.3", "Drama,History", "180m", "The story of J. Robert Oppenheimer and the creation of the atomic bomb."],
  ["The Batman", "2022", "movie", "7.8", "Action,Crime", "176m", "A vengeance-driven Bruce Wayne hunts a serial killer unmasking Gotham's corruption."],
  ["Everything Everywhere All at Once", "2022", "movie", "7.8", "Sci-Fi,Comedy", "139m", "A laundromat owner is swept into a multiverse-spanning fight to save every version of herself."],
  ["Top Gun: Maverick", "2022", "movie", "8.2", "Action,Drama", "131m", "Pete Mitchell trains a new generation of pilots for a mission that demands the ultimate sacrifice."],
  ["Blade Runner 2049", "2017", "movie", "8.0", "Sci-Fi,Thriller", "164m", "A young blade runner uncovers a secret that could plunge what's left of society into chaos."],
  ["Mad Max: Fury Road", "2015", "movie", "8.1", "Action,Adventure", "120m", "In a post-apocalyptic wasteland, Furiosa and Max flee a tyrant across the desert."],
  ["Interstellar", "2014", "movie", "8.7", "Sci-Fi,Drama", "169m", "Explorers travel through a wormhole in an attempt to ensure humanity's survival."],
  ["Parasite", "2019", "movie", "8.5", "Thriller,Drama", "132m", "A poor family schemes to become employed by a wealthy household."],
  ["Spider-Man: Across the Spider-Verse", "2023", "movie", "8.6", "Animation,Action", "140m", "Miles Morales is catapulted across the multiverse to face a society of Spider-People."],
  ["Killers of the Flower Moon", "2023", "movie", "7.6", "Crime,Drama", "206m", "Members of the Osage Nation are murdered under mysterious circumstances in 1920s Oklahoma."],
  ["Poor Things", "2023", "movie", "7.8", "Comedy,Romance", "141m", "A young woman brought back to life by a scientist runs off on a whirlwind adventure."],
  ["The Whale", "2022", "movie", "7.6", "Drama", "117m", "A reclusive teacher attempts to reconnect with his estranged teenage daughter."],
  ["Sinners", "2025", "movie", "7.9", "Horror,Thriller", "137m", "Twin brothers return home to start over, only to find a greater evil waiting for them."],
  ["Nope", "2022", "movie", "6.8", "Horror,Sci-Fi", "130m", "Residents of a lonely California gulch witness an uncanny discovery in the sky."],
  ["Arrival", "2016", "movie", "7.9", "Sci-Fi,Drama", "116m", "A linguist is recruited to communicate with extraterrestrial visitors."],
  ["Whiplash", "2014", "movie", "8.5", "Drama,Music", "106m", "A promising drummer is pushed to his limit by a ruthless instructor."],
  ["Knives Out", "2019", "movie", "7.9", "Mystery,Comedy", "130m", "A detective investigates the death of a patriarch of an eccentric family."],
  ["John Wick: Chapter 4", "2023", "movie", "7.7", "Action,Thriller", "169m", "John Wick uncovers a path to defeating the High Table."],
  ["The Grand Budapest Hotel", "2014", "movie", "8.1", "Comedy,Adventure", "99m", "A legendary concierge and his protégé are framed for murder."],
  ["Succession", "2018", "series", "8.9", "Drama", "4 Seasons", "The Roy family battles for control of a global media empire."],
  ["The Last of Us", "2023", "series", "8.7", "Drama,Thriller", "2 Seasons", "A smuggler escorts a teenage girl across a post-pandemic America."],
  ["House of the Dragon", "2022", "series", "8.4", "Fantasy,Drama", "2 Seasons", "The Targaryen civil war tears Westeros apart two centuries before Game of Thrones."],
  ["Chernobyl", "2019", "series", "9.3", "Drama,History", "1 Season", "The 1986 nuclear accident and the sacrifices made to contain it."],
  ["Breaking Bad", "2008", "series", "9.5", "Crime,Drama", "5 Seasons", "A chemistry teacher turned meth manufacturer partners with a former student."],
  ["Severance", "2022", "series", "8.7", "Thriller,Sci-Fi", "2 Seasons", "Employees surgically divide their memories between work and personal lives."],
  ["The Bear", "2022", "series", "8.6", "Drama,Comedy", "4 Seasons", "A fine-dining chef returns home to run his family's sandwich shop."],
  ["True Detective", "2014", "series", "8.9", "Crime,Mystery", "4 Seasons", "Seasonal anthology following detectives through dark, personal investigations."],
  ["Shōgun", "2024", "series", "8.6", "Drama,History", "1 Season", "An English navigator becomes entangled in feudal Japan's brutal power struggle."],
  ["Dark", "2017", "series", "8.7", "Sci-Fi,Mystery", "3 Seasons", "Four families search for a missing child and uncover a time-travel conspiracy."],
  ["The Penguin", "2024", "series", "8.5", "Crime,Drama", "1 Season", "Oswald Cobb rises through Gotham's underworld after the Riddler's flood."],
  ["Andor", "2022", "series", "8.4", "Sci-Fi,Drama", "2 Seasons", "Cassian Andor's journey from thief to revolutionary in the fight against the Empire."],
  ["Fallout", "2024", "series", "8.3", "Sci-Fi,Adventure", "1 Season", "A vault dweller ventures into the irradiated wasteland of a retro-future Los Angeles."],
  ["Peaky Blinders", "2013", "series", "8.8", "Crime,Drama", "6 Seasons", "A gangster family in 1900s Birmingham builds an empire."],
  ["The Wire", "2002", "series", "9.3", "Crime,Drama", "5 Seasons", "Baltimore's drug trade seen through the eyes of both sides of the law."],
  ["Euphoria", "2019", "series", "8.4", "Drama", "2 Seasons", "A group of high school students navigate love, loss and addiction."],
  ["Westworld", "2016", "series", "8.5", "Sci-Fi,Western", "4 Seasons", "A theme park of androids begins to break its programming."],
  ["The White Lotus", "2021", "series", "7.9", "Drama,Comedy", "3 Seasons", "Guests and staff of a luxury resort unravel over one eventful week."],
  ["Mare of Easttown", "2021", "series", "8.4", "Crime,Drama", "1 Season", "A small-town detective investigates a murder while her life falls apart."],
  ["Band of Brothers", "2001", "series", "9.4", "War,Drama", "1 Season", "The story of Easy Company from training through the end of World War II."],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const OFFLINE_ITEMS: CatalogItem[] = SEEDS.map(
  ([title, year, type, rating, genres, duration, description]) => ({
    id: `offline-${slug(title)}`,
    title,
    type,
    year,
    rating,
    genres: genres.split(","),
    duration,
    description,
    seasonCount: type === "series" ? Number(duration.split(" ")[0]) : undefined,
  }),
);

const byId = (ids: string[]) =>
  ids.map((id) => OFFLINE_ITEMS.find((i) => i.id === id)).filter((i): i is CatalogItem => !!i);

const pickTitles = (...titles: string[]) => byId(titles.map((t) => `offline-${slug(t)}`));

export function offlineRows(): CatalogRow[] {
  const movies = OFFLINE_ITEMS.filter((i) => i.type === "movie");
  const series = OFFLINE_ITEMS.filter((i) => i.type === "series");

  const rows: CatalogRow[] = [
    {
      id: "offline-hero",
      title: "Featured",
      kind: "hero",
      items: pickTitles("Dune: Part Two", "The Last of Us", "Oppenheimer", "House of the Dragon", "Severance"),
    },
    { id: "offline-trending", title: "Trending Now", kind: "top10", items: [...movies.slice(0, 5), ...series.slice(0, 5)] },
    { id: "offline-max-originals", title: "Max Originals", kind: "rail", items: series.slice(0, 10) },
    { id: "offline-blockbusters", title: "Blockbuster Movies", kind: "rail", items: movies.slice(0, 12) },
    { id: "offline-prestige", title: "Prestige Drama", kind: "rail", items: [...series.slice(3, 12)] },
    { id: "offline-scifi", title: "Sci-Fi & Fantasy", kind: "rail", items: OFFLINE_ITEMS.filter((i) => i.genres?.some((g) => /Sci-Fi|Fantasy/.test(g))) },
    { id: "offline-crime", title: "Crime & Mystery", kind: "rail", items: OFFLINE_ITEMS.filter((i) => i.genres?.some((g) => /Crime|Mystery|Thriller/.test(g))) },
    { id: "offline-movies", title: "All Movies", kind: "rail", items: movies },
    { id: "offline-series", title: "All Series", kind: "rail", items: series },
  ];
  return rows.filter((r) => r.items.length > 0);
}

export function offlineSearch(query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return OFFLINE_ITEMS.filter(
    (i) => i.title.toLowerCase().includes(q) || i.genres?.some((g) => g.toLowerCase().includes(q)),
  );
}

export const offlineItem = (id: string): CatalogItem | undefined => OFFLINE_ITEMS.find((i) => i.id === id);
