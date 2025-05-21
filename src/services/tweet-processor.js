const puppeteer = require("puppeteer");
const { defaultSettings } = require("../config");
const { formatAccountUrl } = require("../utils/helpers");
const { getMainWindow } = require("../window");
const tweetScraper = require("./tweet-scraper");
const tweetParser = require("./tweet-parser");
const mediaHandler = require("./media-handler");
const bufferClient = require("./buffer-client");
const textInputHandler = require("./text-input-handler");
const fs = require("fs");
const path = require("path");

let shouldStop = false;
let browser = null;
let page = null;
const TWEET_ID_STORE_PATH = path.join(__dirname, "tweet_ids.json");

/**
 * Tweet işleme sürecini başlatır
 * @param {Object} event Event nesnesi
 * @param {Object} data İşlem verileri
 */
async function startProcess(event, data) {
  shouldStop = false;
  const tweetIdsStore = loadTweetIds();
  try {
    event.reply("update-status", "İşlem başlatılıyor...");

    // Verileri ayıkla
    const {
      accountUrl,
      bufferEmail,
      bufferPassword,
      xUsername,
      xPassword,
      settings = defaultSettings,
    } = data;
    let tweetIntervals = data.tweetIntervals || [];

    // Zaman aşımı sürelerini hesapla
    const pageTimeout = settings.pageTimeout * 1000;
    const elementTimeout = settings.elementTimeout * 1000;
    const headlessMode = settings.headlessMode;
    const autoPublish = settings.autoPublish;

    // Hesap URL kontrolü
    if (!accountUrl) {
      event.reply("update-status", "Hesap URL bulunamadı!");
      return;
    }

    // Buffer giriş bilgisi kontrolü
    if (!bufferEmail || !bufferPassword) {
      event.reply("update-status", "Buffer giriş bilgileri eksik!");
      return;
    }

    // X giriş bilgisi kontrolü
    if (!xUsername || !xPassword) {
      event.reply("update-status", "X giriş bilgileri eksik!");
      return;
    }

    // Hesap URL'sini formatla
    const formattedAccountUrl = formatAccountUrl(accountUrl);

    // Tarayıcıyı başlat (sadece ilk seferde)
    if (!browser) {
      event.reply("update-status", "Tarayıcı başlatılıyor...");
      browser = await puppeteer.launch({
        product: 'chrome',
        channel: 'chrome',
        headless: headlessMode,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--start-maximized'
        ],
        ignoreHTTPSErrors: true,
        timeout: 60000
      });
    }
    // Sayfa oluştur (ilk seferde veya sayfa kapalıysa)
    if (!page || page.isClosed()) {
      page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      page.setDefaultNavigationTimeout(pageTimeout);
      page.setDefaultTimeout(elementTimeout);
    }

    try {
      // X'e giriş yap
      await loginToX(page, xUsername, xPassword, (msg) => event.reply("update-status", msg));

      let planLoop = async () => {
        for (let i = 0; i < tweetIntervals.length; i++) {
          if (shouldStop) break;
          let tweetUrl = null;
          let currentAccount = accountUrl;
          let triedAccounts = [];
          let tweetSuccessfullyProcessed = false;
          let tweetIdFound = false;
          for (const acc of [accountUrl, data.secondaryAccountUrl, data.tertiaryAccountUrl]) {
            if (!acc || triedAccounts.includes(acc)) continue;
            triedAccounts.push(acc);
            const formattedAccountUrl = formatAccountUrl(acc);
            try {
              event.reply("update-status", `${acc} hesabında son 10 tweet kontrol ediliyor...`);
              await page.goto(formattedAccountUrl, { waitUntil: "networkidle2" });
              await tweetScraper.injectTweetParseFunctions(page);
              // Son 10 tweeti al
              const tweetUrls = await tweetScraper.findLatestTweets(page, elementTimeout, 10);
              event.reply("update-status", `Bulunan tweetler: ${JSON.stringify(tweetUrls)}`);
              // Tweet ID store'da bu hesap için alan yoksa oluştur
              if (!tweetIdsStore[acc]) tweetIdsStore[acc] = [];
              for (const candidateUrl of tweetUrls) {
                const normalizedUrl = normalizeTweetUrl(candidateUrl);
                const tweetId = extractTweetIdFromUrl(normalizedUrl);
                if (!tweetId) continue;
                if (!tweetIdsStore[acc].includes(tweetId)) {
                  // Tweet daha önce kopyalanmamış, işleme al
                  event.reply("update-status", `İşlenecek yeni tweet bulundu: ${candidateUrl}`);
                  let success = false;
                  for (let retry = 0; retry < 2 && !success; retry++) {
                    const result = await processTweet(
                      page,
                      candidateUrl,
                      elementTimeout,
                      bufferEmail,
                      bufferPassword,
                      autoPublish,
                      pageTimeout,
                      (msg) => event.reply("update-status", msg)
                    );
                    if (result) {
                      tweetIdsStore[acc].push(tweetId);
                      saveTweetIds(tweetIdsStore);
                      event.reply("update-status", `Tweet başarıyla kopyalandı ve kaydedildi: ${candidateUrl}`);
                      tweetSuccessfullyProcessed = true;
                      tweetIdFound = true;
                      break;
                    } else {
                      event.reply("update-status", `Tweet işlenemedi, tekrar deneniyor: ${candidateUrl}`);
                    }
                  }
                  if (tweetIdFound) break;
                } else {
                  event.reply("update-status", `Tweet zaten kopyalanmış: ${candidateUrl}`);
                }
              }
              if (tweetIdFound) break;
            } catch (err) {
              event.reply("update-status", `${acc} için tweet çekilemedi, sıradaki hesaba geçiliyor. Hata: ${err.message}`);
              continue;
            }
          }
          if (!tweetIdFound) {
            event.reply("update-status", "Hiçbir hesaptan yeni tweet bulunamadı veya hepsi daha önce kopyalanmış, bu aralık atlanıyor.");
            continue;
          }
          // Sadece başarılı işlendiyse bekle
          if (i < tweetIntervals.length - 1) {
            const waitSeconds = tweetIntervals[i] * 60;
            if (event.reply) event.reply('start-countdown', waitSeconds);
            for (let s = 0; s < waitSeconds; s++) {
              if (shouldStop) break;
              await new Promise(res => setTimeout(res, 1000));
            }
          }
        }
      };
      // Sonsuz döngü: 1 saatlik plan bitince yeni plan oluştur
      while (!shouldStop) {
        await planLoop();
        if (shouldStop) break;
        // Yeni plan oluştur (rastgele aralıklar)
        const tweetCount = tweetIntervals.length;
        tweetIntervals = generateRandomIntervals(tweetCount);
        if (event.reply) event.reply('new-plan', tweetCount);
        event.reply("update-status", "Yeni 1 saatlik plan başlatıldı!");
      }
      event.reply("update-status", "Tüm tweetler paylaşıldı!");
    } catch (error) {
      throw error;
    }
  } catch (error) {
    event.reply("update-status", `Hata oluştu: ${error.message}`);
    console.error(error);
  } finally {
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      try {
        event.reply(
          "update-status",
          shouldStop ? "İşlem iptal edildi - buton etkinleştirildi!" : "İşlem tamamlandı - buton etkinleştirildi!"
        );
      } catch (e) {
        console.error("Final bildirim hatası:", e);
      }
    }
  }
}

/**
 * Tarayıcı başlatır
 * @param {boolean} headlessMode Başsız mod
 * @returns {Object} Tarayıcı nesnesi
 */
async function launchBrowser(headlessMode) {
  return await puppeteer.launch({
    headless: headlessMode,
    args: ["--start-maximized"],
  });
}

/**
 * Tarayıcı sayfası oluşturur
 * @param {Object} browser Tarayıcı nesnesi
 * @param {number} pageTimeout Sayfa zaman aşımı
 * @param {number} elementTimeout Element zaman aşımı
 * @returns {Object} Sayfa nesnesi
 */
async function createPage(browser, pageTimeout, elementTimeout) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  page.setDefaultNavigationTimeout(pageTimeout);
  page.setDefaultTimeout(elementTimeout);
  return page;
}

/**
 * Hesaptan son tweeti bulur
 * @param {Object} page Tarayıcı sayfası
 * @param {string} accountUrl Hesap URL'si
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {string|null} Tweet URL'si veya null
 */
async function findLatestTweetFromAccount(
  page,
  accountUrl,
  timeout,
  statusCallback
) {
  statusCallback(`Hesap sayfası yükleniyor: ${accountUrl}...`);
  await page.goto(accountUrl, { waitUntil: "networkidle2" });

  statusCallback("Son tweet aranıyor...");
  await tweetScraper.injectTweetParseFunctions(page);

  const tweetUrl = await tweetScraper.findLatestTweet(page, timeout);

  if (!tweetUrl) {
    statusCallback("Tweet bulunamadı!");
    return null;
  }

  statusCallback(`Son normal tweet bulundu: ${tweetUrl}`);
  return tweetUrl;
}

/**
 * Tweet'i işler
 * @param {Object} page Tarayıcı sayfası
 * @param {string} tweetUrl Tweet URL'si
 * @param {number} elementTimeout Element zaman aşımı
 * @param {string} bufferEmail Buffer e-posta
 * @param {string} bufferPassword Buffer şifre
 * @param {boolean} autoPublish Otomatik paylaşım
 * @param {number} pageTimeout Sayfa zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {boolean} Başarılı ise true, değilse false
 */
async function processTweet(
  page,
  tweetUrl,
  elementTimeout,
  bufferEmail,
  bufferPassword,
  autoPublish,
  pageTimeout,
  statusCallback
) {
  try {
    // Tweet sayfasına git
    await page.goto(tweetUrl, { waitUntil: "networkidle2" });

    // Tweet metnini al
    statusCallback("Tweet içeriği alınıyor...");
    const tweetText = await tweetParser.extractTweetText(page, elementTimeout);

    if (tweetText) {
      statusCallback(`Tweet metni alındı: ${tweetText}`);
    } else {
      statusCallback("Tweet metni bulunamadı");
    }

    // Medya dosyasını indir
    let mediaPath = await mediaHandler.downloadTweetPhoto(
      page,
      elementTimeout,
      statusCallback
    );

    // Eğer fotoğraf yoksa video dene
    if (!mediaPath) {
      mediaPath = await mediaHandler.downloadTweetVideo(
        tweetUrl,
        statusCallback
      );
    }

    if (!mediaPath) {
      statusCallback("Medya dosyası bulunamadı, işlem iptal edildi");
      return false;
    }

    // Buffer'a giriş yap
    await bufferClient.login(page, bufferEmail, bufferPassword, statusCallback);

    // Kompozisyon sayfasını aç
    if (
      !(await bufferClient.openComposePage(
        page,
        elementTimeout,
        statusCallback
      ))
    ) {
      statusCallback("Kompozisyon sayfası açılamadı");
      return false;
    }

    // Tweet metnini gir
    if (
      !(await textInputHandler.typeTextIntoComposer(
        page,
        tweetText,
        elementTimeout,
        statusCallback
      ))
    ) {
      statusCallback("Tweet metni eklenemedi");
      return false;
    }

    // Medya yükle
    statusCallback("Medya yükleniyor...");
    const inputUploadHandle = await page.$('input[type="file"]');
    await inputUploadHandle.uploadFile(mediaPath);
    await page.waitForTimeout(5000);

    // Post işlemini tamamla (paylaş veya kuyruğa ekle)
    if (autoPublish) {
      await bufferClient.publishNow(page, elementTimeout, statusCallback);
    } else {
      await bufferClient.addToQueue(page, elementTimeout, statusCallback);
    }

    // Geçici dosyayı temizle
    mediaHandler.cleanupMediaFile(mediaPath, statusCallback);

    return true;
  } catch (error) {
    statusCallback(`Tweet işleme hatası: ${error.message}`);
    console.error("Tweet işleme hatası:", error);
    return false;
  }
}

/**
 * X (Twitter) hesabına giriş yapar
 * @param {Object} page Puppeteer sayfası
 * @param {string} username X kullanıcı adı
 * @param {string} password X şifre
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function loginToX(page, username, password, statusCallback) {
  statusCallback("X hesabı oturum kontrolü yapılıyor...");
  await page.goto("https://x.com/home", { waitUntil: "networkidle2" });

  // Oturum açık mı kontrol et (profil simgesi, tweet butonu vs.)
  const isLoggedIn = await page.$('a[aria-label="Profile"], div[data-testid="SideNav_AccountSwitcher_Button"], a[aria-label="Tweet"]');
  if (isLoggedIn) {
    statusCallback("X hesabında zaten oturum açık, giriş atlanıyor.");
    return;
  }

  statusCallback("X hesabına giriş yapılıyor...");
  await page.goto("https://x.com/login", { waitUntil: "networkidle2" });
  await page.waitForSelector('input[name="text"]', { timeout: 20000 });
  await page.type('input[name="text"]', username, { delay: 100 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  await page.waitForSelector('input[name="password"]', { timeout: 20000 });
  await page.type('input[name="password"]', password, { delay: 100 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);
  statusCallback("X hesabına giriş yapıldı.");
}

function stopProcess(event) {
  shouldStop = true;
}

// Uygulama kapanırken tarayıcıyı kapat
process.on('exit', async () => {
  if (browser) await browser.close();
});

// Rastgele aralıklar oluşturucu (backend için)
function generateRandomIntervals(tweetCount, totalMinutes = 60) {
  if (tweetCount < 2) return [totalMinutes];
  let points = [];
  for (let i = 0; i < tweetCount - 1; i++) {
    points.push(Math.random() * totalMinutes);
  }
  points.sort((a, b) => a - b);
  let intervals = [];
  for (let i = 0; i < tweetCount; i++) {
    if (i === 0) {
      intervals.push(points[0]);
    } else if (i === tweetCount - 1) {
      intervals.push(totalMinutes - points[points.length - 1]);
    } else {
      intervals.push(points[i] - points[i - 1]);
    }
  }
  intervals = intervals.map(x => Math.max(1, Math.round(x)));
  let diff = totalMinutes - intervals.reduce((a, b) => a + b, 0);
  intervals[intervals.length - 1] += diff;
  return intervals;
}

// Tweet URL'sinden tweet ID'sini ayıklayan yardımcı fonksiyon
function extractTweetIdFromUrl(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Tweet URL'sini normalize eden yardımcı fonksiyon
function normalizeTweetUrl(url) {
  return url ? url.split('?')[0].replace(/\/$/, '') : url;
}

function loadTweetIds() {
  try {
    if (!fs.existsSync(TWEET_ID_STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(TWEET_ID_STORE_PATH, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveTweetIds(data) {
  fs.writeFileSync(TWEET_ID_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  startProcess,
  stopProcess,
};

