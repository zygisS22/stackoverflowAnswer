const puppeteer = require("puppeteer");
const fs = require("fs");
const shortid = require("shortid");

const FOLDER_PATH = "/answers/";

if (process.argv.length !== 3) {
  console.error("Expected a query argument");
  process.exit(1);
}

const args = process.argv;
const query = args[2];

const createDir = async (dirPath) => {
  fs.access(process.cwd() + dirPath, (error) => {
    if (error) {
      fs.mkdirSync(process.cwd() + dirPath, { recursive: true }, (error) => {
        if (error) {
          console.error("Error creating dir", error);
        } else {
          console.log("Directory created");
        }
      });
    }
  });
};

const getAnswerFromQuestion = async (website, query, page) => {
  console.log("Website", website);
  await page.goto(website, ["load", "domcontentloaded", "networkidle0"]);
  const popUp = (await page.$x("//button[@title='Dismiss']"))[0];
  if (popUp) await popUp.click();

  const generateId = shortid.generate();
  const screenshotPath = `${generateId}.png`;
  const acceptedAnswer = await page.$(".accepted-answer");

  if (!acceptedAnswer) return;

  const pathToSaveScreenshot = `/answers/${query}/`;

  await createDir(pathToSaveScreenshot);

  await acceptedAnswer.screenshot({
    path: `.${pathToSaveScreenshot}${screenshotPath}`,
  });
};

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
    });

    const page = await browser.newPage();

    page.on("console", (msg) => {
      for (let i = 0; i < msg._args.length; ++i)
        console.log(`${i}: ${msg._args[i]}`);
    });

    const queryWordArray = query.split(" ");
    const queryFolderId = query.replace(/ /g, "");
    const queryUrl = `${query.replace(/ /g, "%20")}`;
    const googleUrl = `https://www.google.com/search?q=${queryUrl}+site%3Astackoverflow.com`;

    await page.goto(googleUrl, ["load", "domcontentloaded", "networkidle0"]);

    const validUrls = await page.evaluate((queryUrl) => {
      const hrefElementsList = Array.from(
        document.querySelectorAll(
          `div[data-async-context='query:${queryUrl}%20site%3Astackoverflow.com'] a[href]`
        )
      );

      const filterElementsList = hrefElementsList.filter((elem) =>
        elem
          .getAttribute("href")
          .startsWith("https://stackoverflow.com/questions")
      );

      const stackOverflowLinks = filterElementsList.map((elem) =>
        elem.getAttribute("href")
      );

      return stackOverflowLinks;
    }, queryUrl);

    const keywordLikeability = [];

    validUrls.forEach((url) => {
      let wordCounter = 0;

      queryWordArray.forEach((word) => {
        if (url.indexOf(word) > -1) {
          wordCounter = wordCounter + 1;
        }
      });

      if (queryWordArray.length / 2 < wordCounter) {
        keywordLikeability.push({
          keywordMatch: wordCounter,
          url: url,
        });
      }
    });

    /*

    Order by number of matched words

      keywordLikeability.sort((a, b) =>
        b.keywordMatch > a.keywordMatch ? 1 : -1
      );

    */

    await createDir(FOLDER_PATH);

    await (async function () {
      for (var i = 0; i < keywordLikeability.length; i++) {
        if (i < 4) {
          await getAnswerFromQuestion(
            keywordLikeability[i].url,
            queryFolderId,
            page
          );
        }
      }

      await browser.close();
    })();
  } catch (error) {
    console.log("Error " + error.toString());
  }
})();
