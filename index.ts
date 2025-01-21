import axios from "axios";
import * as cheerio from "cheerio";
import { appendFileSync } from "fs";

// Chapters

export interface Chapter {
  info: { views: string; time: string; chapter: string };
  link: string | undefined;
}

export function buildChapters($: cheerio.CheerioAPI): Array<Chapter> {
  const chapter_list = "ul li.a-h";
  let Chapters: Array<Chapter> = [];

  $(chapter_list).each((i, elem) => {
    const temp = cheerio.load(String($(elem).html()));

    Chapters.push({
      info: {
        views: temp(".chapter-view").text(),
        time: temp(".chapter-time").text(),
        chapter: temp("a").text().split(" ")[1],
      },
      link: temp("a").attr("href"),
    });
  });

  return Chapters.reverse();
}

// Story Info

export interface Manga {
  img: string | undefined;
  title: Array<string> | string;
  alt_titles: Array<string> | string;
  authors: Array<string> | string;
  status: Array<string> | string;
  genres: Array<string> | string;
  views: Array<string> | string;
  description: Array<string> | string;
  chapters: Array<Chapter>;
  lastUpdated: Array<string> | string;
}

export async function buildManga(link: string): Promise<Manga> {
  const res = await axios.get(link);
  const $ = cheerio.load(res.data);
  const story_info = "div.panel-story-info";
  const tables = story_info.concat(" table tbody tr");

  const firstArray = $(tables).toArray();
  const secondArray = $(story_info.concat(" div.story-info-right-extent p"))
    .toArray()
    .slice(0, 3);

  const getSon = (elem: any): string | string[] => {
    const val = $(elem).children().last().text();

    if (val.includes(" ; ")) {
      return val.split(" ; ");
    }

    if (val.includes(" - ")) {
      return val.split(" - ");
    }

    return val;
  };

  return {
    img: $(story_info.concat(" img")).attr("src"),
    title: String(),
    alt_titles: getSon(firstArray[0]),
    authors: getSon(firstArray[1]),
    status: getSon(firstArray[2]),
    genres: getSon(firstArray[3]),
    lastUpdated: $(secondArray[0]).children().last().text(),
    views: $(secondArray[1]).children().last().text(),
    description: "",
    chapters: buildChapters($),
  };
}

//const link = "https://chapmanganato.to/manga-kb988110"
//buildManga(link);
