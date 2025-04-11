const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { app } = require("electron");
const YTDlpWrap = require("yt-dlp-wrap").default;

/**
 * Tweet'ten fotoğraf indirir
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {string|null} İndirilen dosya yolu veya null
 */
async function downloadTweetPhoto(page, timeout, statusCallback) {
  try {
    statusCallback("Fotoğraf kontrol ediliyor...");
    await page.waitForSelector('div[data-testid="tweetPhoto"] img', {
      timeout: timeout,
    });

    const imgUrl = await page.evaluate(() => {
      const img = document.querySelector('div[data-testid="tweetPhoto"] img');
      return img ? img.src : null;
    });

    if (imgUrl) {
      statusCallback("Fotoğraf indiriliyor...");
      const imgResponse = await axios.get(imgUrl, {
        responseType: "arraybuffer",
      });
      const imgPath = path.join(app.getPath("temp"), "x.jpg");
      fs.writeFileSync(imgPath, Buffer.from(imgResponse.data));
      statusCallback("Fotoğraf indirildi");
      return imgPath;
    }
  } catch (error) {
    statusCallback("Fotoğraf bulunamadı");
    console.error("Fotoğraf indirme hatası:", error);
  }
  return null;
}

/**
 * Tweet'ten video indirir
 * @param {string} tweetUrl Tweet URL'si
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {string|null} İndirilen dosya yolu veya null
 */
async function downloadTweetVideo(tweetUrl, statusCallback) {
  try {
    const ytDlp = new YTDlpWrap();
    statusCallback("Video URL alınıyor...");

    const videoInfo = await ytDlp.getVideoInfo(tweetUrl);
    if (videoInfo.url) {
      statusCallback("Video indiriliyor...");
      const videoPath = path.join(app.getPath("temp"), "x.mp4");
      const videoResponse = await axios.get(videoInfo.url, {
        responseType: "arraybuffer",
      });
      fs.writeFileSync(videoPath, Buffer.from(videoResponse.data));
      statusCallback("Video indirildi");
      return videoPath;
    }
  } catch (error) {
    statusCallback("Video bulunamadı");
    console.error("Video indirme hatası:", error);
  }
  return null;
}

/**
 * Geçici medya dosyasını temizler
 * @param {string} mediaPath Medya dosya yolu
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
function cleanupMediaFile(mediaPath, statusCallback) {
  if (fs.existsSync(mediaPath)) {
    fs.unlinkSync(mediaPath);
    statusCallback("Geçici dosya silindi");
  }
}

module.exports = {
  downloadTweetPhoto,
  downloadTweetVideo,
  cleanupMediaFile,
};
