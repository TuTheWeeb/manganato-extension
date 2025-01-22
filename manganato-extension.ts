import axios from "axios";
import * as cheerio from "cheerio";
import { ElementHandle, executablePath, type NodeFor } from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

function reverse(s: string): string {
  return s.split("").reverse().join("")
}

function parseCode(s: string): ChapterCode {
  s = reverse(s)

  const chapter = reverse(s.slice(0, s.indexOf("-")))
  s = s.slice(s.indexOf("/")+1)
  const manga_code = reverse(s.slice(0, s.indexOf("-")))
  
  return {manga_code: manga_code, chapter: chapter}
}

async function loadData(link: string) {
  const res = await axios.get(link);
  return cheerio.load(res.data);
}

function clean(data: string | string[]) {
  if (typeof data === "string") {
    data = data.trim();
  } else if (typeof data === "object") {
    data = data.map((d) => d.trim());
  }

  return data;
}

// Chapters

export interface ChapterCode {
  manga_code: string,
  chapter: string
}

export interface ChapterInfo {
  info: { views: string; time: string; chapter: string };
  code: ChapterCode;
}

export function buildChapters($: cheerio.CheerioAPI): Array<ChapterInfo> {
  const chapter_list = "ul li.a-h";
  let Chapters: Array<ChapterInfo> = [];

  $(chapter_list).each((i, elem) => {
    const temp = cheerio.load(String($(elem).html()));
    let code = parseCode(temp("a").attr("href"));

    Chapters.push({
      info: {
        views: temp(".chapter-view").text(),
        time: temp(".chapter-time").text(),
        chapter: temp("a").text().split(" ")[1],
      },
      code: code,
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
  chapters: Array<ChapterInfo>;
  lastUpdated: Array<string> | string;
}

export async function buildMangaFromManganato(code: string): Promise<Manga> {
  const link = `https://chapmanganato.to/manga-${code}`

  const $ = await loadData(link);
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

  let desc = $("div.panel-story-info-description").text();
  desc = desc.slice(desc.indexOf(":") + 1);

  return Promise.resolve({
    img: $(story_info.concat(" img")).attr("src"),
    title: $("div.story-info-right > h1").text(),
    alt_titles: clean(getSon(firstArray[0])),
    authors: clean(getSon(firstArray[1])),
    status: clean(getSon(firstArray[2])),
    genres: clean(getSon(firstArray[3])),
    lastUpdated: clean($(secondArray[0]).children().last().text()),
    views: clean($(secondArray[1]).children().last().text()),
    description: clean(desc),
    chapters: buildChapters($),
  });
}

async function downloadPages(
  elements: Array<ElementHandle<NodeFor<any>>>,
  path: string
) {
  for (let i = 0; i < elements.length; i++) {
    try {
      await elements.at(i)?.screenshot({
        path: `./${path}/${i}.png`,
        omitBackground: true,
        optimizeForSpeed: true,
      });
    } catch {
      (err: Error) => {
        console.log(err);
      };
    }
  }
}

async function getPages(
  elements: Array<ElementHandle<NodeFor<any>>>
): Promise<Array<Uint8Array>> {
  const imgs: Array<Uint8Array> = [];

  for (let i = 0; i < elements.length; i++) {
    try {
      await elements
        .at(i)
        ?.screenshot({
          omitBackground: true,
          optimizeForSpeed: true,
        })
        .then((img) => imgs.push(img));
    } catch {
      (err: Error) => {
        console.log(err);
      };
    }
  }

  return Promise.resolve(imgs);
}

export async function downloadChapter(
  code: ChapterCode,
  path: string,
  chrome_path: string | null
) {
  const link = `https://chapmanganato.to/manga-${code.manga_code}/chapter-${code.chapter}`

  if (chrome_path === null) {
    chrome_path = executablePath();
  }

  await puppeteer
    .use(StealthPlugin())
    .launch({
      headless: true,
      executablePath: chrome_path,
      defaultViewport: null,
    })
    .then(async (browser: any) => {
      console.log("Runing...");
      const page = await browser.newPage();
      await page.goto(link);
      await Bun.sleep(1000);
      const imgs = await page.$$("div.container-chapter-reader > img", false);
      await downloadPages(imgs, path);

      await browser.close();
    });
}

export async function getChapter(
  code: ChapterCode,
  chrome_path: string | null
): Promise<Array<Uint8Array>> {
  const link = `https://chapmanganato.to/manga-${code.manga_code}/chapter-${code.chapter}`

  if (chrome_path === null) {
    chrome_path = executablePath();
  }

  let imgs: Array<Uint8Array> = [];

  await puppeteer
    .use(StealthPlugin())
    .launch({
      headless: true,
      executablePath: chrome_path,
      defaultViewport: null,
    })
    .then(async (browser: any) => {
      console.log("Geting pages...");
      const page = await browser.newPage();
      await page.goto(link);
      await Bun.sleep(2000);
      const html_imgs = await page.$$(
        "div.container-chapter-reader > img",
        true
      );
      imgs = await getPages(html_imgs);

      await browser.close();
    });

  return Promise.resolve(imgs);
}

