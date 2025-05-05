/**
 * X.com'dan en son pinlenmemiş tweeti bulmak için sayfa değerlendirmesi
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı (ms)
 * @returns {string|null} Tweet URL'si veya null
 */
async function findLatestTweet(page, timeout) {
  try {
    // Son tweetleri bul
    await page.waitForSelector('article[data-testid="tweet"]', {
      timeout: timeout,
    });

    // Tweet URL'sini al, pinlenmiş tweetleri atla
    return page.evaluate(() => {
      // Tüm tweetleri al
      const tweetElements = document.querySelectorAll(
        'article[data-testid="tweet"]'
      );
      if (!tweetElements.length) return null;

      // Tweet bilgilerini toplayalım
      const tweets = [];

      for (let i = 0; i < tweetElements.length; i++) {
        const tweet = window.parseTweetFromElement(tweetElements[i], i);
        if (tweet) tweets.push(tweet);
      }

      console.log("Bulunan tweetler:", tweets);

      // Pinlenmemiş tweetleri filtrele
      const unpinnedTweets = tweets.filter((t) => !t.isPinned);

      if (unpinnedTweets.length > 0) {
        return window.selectLatestTweet(unpinnedTweets);
      }

      // Eğer tüm tweetler pinlenmişse
      if (tweets.length > 0) {
        return window.selectLatestTweet(tweets);
      }

      return null;
    });
  } catch (error) {
    console.error("Tweet arama hatası:", error);
    return null;
  }
}

/**
 * Parse fonksiyonunu sayfaya enjekte eder
 */
async function injectTweetParseFunctions(page) {
  await page.evaluate(() => {
    // Tweet'i DOM elementinden ayrıştırma
    window.parseTweetFromElement = function (tweetElement, index) {
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

        const isPinned =
          hasSocialContext &&
          (tweetElement.textContent.toLowerCase().includes("pin") ||
            tweetElement.textContent.toLowerCase().includes("sabit"));

        // Tweet URL'sini al
        const linkElement = tweetElement.querySelector('a[href*="/status/"]');
        const url = linkElement
          ? "https://x.com" + linkElement.getAttribute("href")
          : null;

        if (url) {
          return { url, time: tweetTime, date: tweetDate, isPinned, index };
        }
      } catch (e) {
        console.error("Tweet analiz hatası:", e);
      }
      return null;
    };

    // En son tweeti seçme
    window.selectLatestTweet = function (tweets) {
      const tweetsWithTime = tweets.filter((t) => t.time !== null);

      if (tweetsWithTime.length > 0) {
        // Zamanı varsa en yeni tweeti bul
        tweetsWithTime.sort((a, b) => b.time - a.time);
        console.log("En yeni tweet seçildi:", tweetsWithTime[0]);
        return tweetsWithTime[0].url;
      } else {
        // Zaman bilgisi yoksa ilk tweeti al
        console.log("Zaman bilgisi olmayan tweet seçildi:", tweets[0]);
        return tweets[0].url;
      }
    };
  });
}

/**
 * X.com'dan en son n tweeti bulmak için
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı (ms)
 * @param {number} count Kaç tweet alınacak
 * @returns {string[]} Tweet URL dizisi
 */
async function findLatestTweets(page, timeout, count = 5) {
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout });
    return await page.evaluate((count) => {
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      if (!tweetElements.length) return [];
      const tweets = [];
      for (let i = 0; i < tweetElements.length && tweets.length < count; i++) {
        const tweet = window.parseTweetFromElement(tweetElements[i], i);
        if (tweet && !tweet.isPinned) tweets.push(tweet);
      }
      // Eğer pinlenmemiş tweet azsa, pinlenmişlerden de ekle
      if (tweets.length < count) {
        for (let i = 0; i < tweetElements.length && tweets.length < count; i++) {
          const tweet = window.parseTweetFromElement(tweetElements[i], i);
          if (tweet && tweet.isPinned) tweets.push(tweet);
        }
      }
      return tweets.map(t => t.url);
    }, count);
  } catch (error) {
    console.error("Tweet arama hatası (çoklu):", error);
    return [];
  }
}

module.exports = {
  findLatestTweet,
  injectTweetParseFunctions,
  findLatestTweets,
};
