import axios from "axios";
import * as cheerio from "cheerio";
import { ElementHandle, executablePath, type NodeFor } from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

async function loadData(link: string) {
  const res = await axios.get(link);
  return cheerio.load(res.data);
}

// Chapters

export interface ChapterInfo {
  info: { views: string; time: string; chapter: string };
  link: string | undefined;
}

export function buildChapters($: cheerio.CheerioAPI): Array<ChapterInfo> {
  const chapter_list = "ul li.a-h";
  let Chapters: Array<ChapterInfo> = [];

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
  chapters: Array<ChapterInfo>;
  lastUpdated: Array<string> | string;
}

export async function buildMangaFromManganato(link: string): Promise<Manga> {
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

async function downloadPages(
  elements: Array<ElementHandle<NodeFor<any>>>,
  path: string
) {
  for (let i = 0; i < elements.length; i++) {
    try {
      await elements.at(i)?.screenshot({
        path: `./${path}/${i}.png`,
        omitBackground: true,
        optimizeForSpeed: true
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
          optimizeForSpeed: true
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

async function downloadChapter(link: string, path: string, chrome_path: string | null) {
  if (chrome_path === null) {
    chrome_path = executablePath()
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

async function getChapter(link: string, chrome_path: string | null): Promise<Array<Uint8Array>> {
  if (chrome_path === null) {
    chrome_path = executablePath()
  }

  let imgs: Array<Uint8Array> = []

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
      const html_imgs = await page.$$("div.container-chapter-reader > img", false);
      imgs = await getPages(html_imgs);

      await browser.close();
    });

  return Promise.resolve(imgs)
}

downloadChapter(
  "https://chapmanganato.to/manga-kt987576/chapter-1",
  "images/",
  "/home/eduardo/.nix-profile/bin/chromium"
);

getChapter("https://chapmanganato.to/manga-kt987576/chapter-1", "/home/eduardo/.nix-profile/bin/chromium").then(imgs => {
  console.log(imgs)
})

