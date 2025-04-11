/**
 * Tweet elementinden bilgileri çıkarır
 * @param {Element} tweetElement Tweet DOM elementi
 * @param {number} index Tweet sıra numarası
 * @returns {Object|null} Tweet bilgileri
 */
function parseTweetElement(tweetElement, index) {
  try {
    // Tweetin zaman damgasını bulmaya çalış
    const timeElement = tweetElement.querySelector("time");
    let tweetTime = null;
    let tweetDate = null;

    if (timeElement) {
      const dateTimeAttr = timeElement.getAttribute("datetime");
      if (dateTimeAttr) {
        tweetTime = new Date(dateTimeAttr).getTime();
        tweetDate = dateTimeAttr;
      }
    }

    // Pinlenmiş tweet kontrolü
    const hasSocialContext = tweetElement.querySelector(
      'div[data-testid="socialContext"]'
    );

    let textContent = "";
    if (hasSocialContext) {
      textContent = hasSocialContext.textContent || "";
    }

    const isPinnedByText =
      textContent.toLowerCase().includes("sabit") ||
      textContent.toLowerCase().includes("pin") ||
      textContent.toLowerCase().includes("fix");

    const hasPinIcon = tweetElement.querySelector(
      'svg[aria-label*="pin"], svg[aria-label*="sabit"]'
    );

    const isPinned = hasSocialContext && (isPinnedByText || hasPinIcon);

    // Tweet URL'sini al
    const linkElement = tweetElement.querySelector('a[href*="/status/"]');

    const url = linkElement
      ? "https://x.com" + linkElement.getAttribute("href")
      : null;

    if (url) {
      return {
        url,
        time: tweetTime,
        date: tweetDate,
        isPinned,
        index,
      };
    }
  } catch (e) {
    console.error("Tweet analiz hatası:", e);
  }
  return null;
}

/**
 * Tweet metni çıkarır
 */
async function extractTweetText(page, timeout) {
  await page.waitForSelector('div[data-testid="tweetText"] span', {
    timeout: timeout,
  });

  return page.evaluate(() => {
    const element = document.querySelector('div[data-testid="tweetText"] span');
    return element ? element.textContent : "";
  });
}

module.exports = {
  parseTweetElement,
  extractTweetText,
};
