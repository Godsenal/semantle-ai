import "dotenv/config";
import { chromium } from "playwright";
import { SemantleBot } from "./openAI";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://semantle-ko.newsjel.ly/");

  const semantleBot = new SemantleBot();

  let word = await semantleBot.start();

  while (true) {
    console.log("guess word: ", word);

    const guessInput = page.locator("#guess");
    const guessSubmit = page.locator("#guess-btn");

    await guessInput.fill(word);
    await guessSubmit.click();

    await page.waitForSelector("#guesses");

    const guessTable = page.locator("#guesses");
    const currentWordTableRow = guessTable.locator(`tr:has-text("${word}")`);

    const canGuess = await currentWordTableRow
      .waitFor({ timeout: 1000 })
      .then(() => true)
      .catch(() => false);

    if (canGuess) {
      const [orderTd, wordTd, similarityTd, rankTd] = await currentWordTableRow
        .locator("td")
        .all();
      const similarity = await similarityTd.innerText();
      const rank = await rankTd.innerText();

      console.log(`${word}'s similarity: ${similarity} rank: ${rank}`);

      word = await semantleBot.guessNextWord(word, Number(similarity), rank);
    } else {
      word = await semantleBot.guessNextWord(word, 0, "1000위 이상");
    }
  }

  // Teardown
  await context.close();
  await browser.close();
})();
