const puppeteer = require("puppeteer");
const { defaultSettings } = require("../config");
const { formatAccountUrl } = require("../utils/helpers");
const { getMainWindow } = require("../window");
const tweetScraper = require("./tweet-scraper");
const tweetParser = require("./tweet-parser");
const mediaHandler = require("./media-handler");
const bufferClient = require("./buffer-client");
const textInputHandler = require("./text-input-handler");

/**
 * Tweet işleme sürecini başlatır
 * @param {Object} event Event nesnesi
 * @param {Object} data İşlem verileri
 */
async function startProcess(event, data) {
  try {
    event.reply("update-status", "İşlem başlatılıyor...");

    // Verileri ayıkla
    const {
      accountUrl,
      bufferEmail,
      bufferPassword,
      settings = defaultSettings,
    } = data;

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

    // Hesap URL'sini formatla
    const formattedAccountUrl = formatAccountUrl(accountUrl);

    // Tarayıcıyı başlat
    event.reply("update-status", "Tarayıcı başlatılıyor...");
    const browser = await launchBrowser(headlessMode);
    const page = await createPage(browser, pageTimeout, elementTimeout);

    try {
      // Hesap sayfasına git ve tweeti bul
      const tweetUrl = await findLatestTweetFromAccount(
        page,
        formattedAccountUrl,
        elementTimeout,
        (msg) => event.reply("update-status", msg)
      );

      if (!tweetUrl) {
        throw new Error("Tweet bulunamadı");
      }

      // Tweet içeriğini işle
      const result = await processTweet(
        page,
        tweetUrl,
        elementTimeout,
        bufferEmail,
        bufferPassword,
        autoPublish,
        pageTimeout,
        (msg) => event.reply("update-status", msg)
      );

      if (!result) {
        throw new Error("Tweet işlenemedi");
      }

      await browser.close();
      event.reply("update-status", "İşlem tamamlandı!");
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    event.reply("update-status", `Hata oluştu: ${error.message}`);
    console.error(error);
  } finally {
    // Her durumda işlem tamamlandı bildirimi gönder
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      try {
        event.reply(
          "update-status",
          "İşlem tamamlandı - buton etkinleştirildi!"
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

module.exports = {
  startProcess,
};
