/**
 * Buffer'a giriş yapar
 * @param {Object} page Puppeteer sayfası
 * @param {string} email Buffer e-posta adresi
 * @param {string} password Buffer şifresi
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function login(page, email, password, statusCallback) {
  statusCallback("Buffer'a giriş yapılıyor...");
  await page.goto(
    "https://login.buffer.com/login?plan=free&cycle=year&cta=bufferSite-globalNav-login-1",
    { waitUntil: "networkidle2" }
  );

  await page.type('input[name="email"]', email, { delay: 100 });
  await page.type('input[name="password"]', password, { delay: 100 });
  await page.keyboard.press("Enter");

  statusCallback("Buffer'a giriş yapıldı, sayfa yükleniyor...");
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  // Buffer açıldığında popup çıkarsa X (kapat) butonuna tıkla
  await page.waitForTimeout(2000);
  // Öncelikli olarak Buffer'ın yeni popup X butonunu dene
  let closeBtn = await page.$('button.publish_close_ObJJi');
  if (!closeBtn) {
    // Eski veya farklı popup'lar için genel close butonlarını dene
    closeBtn = await page.$('button[aria-label="Close"], button.close, .close, button[title="Close"], button[aria-label="Dismiss"], button[aria-label="close"]');
  }
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(2000); // Kapatma sonrası bekle
    statusCallback("Buffer popup'ı varsa X ile kapatıldı ve 2 sn beklendi");
  } else {
    statusCallback("Buffer popup'ı bulunamadı veya kapatılacak popup yok");
  }
}

/**
 * Kompozisyon sayfasını açar
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function openComposePage(page, timeout, statusCallback) {
  try {
    statusCallback("Ortadaki 'New Post' butonu aranıyor...");
    try {
      await page.waitForSelector('button.publish_primary_FQYGy', { timeout: timeout });
      const buttons = await page.$$('button.publish_primary_FQYGy');
      let found = false;
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes('new post')) {
          await btn.click();
          statusCallback("Ortadaki 'New Post' butonuna tıklandı");
          found = true;
          await page.waitForTimeout(1000);
          break;
        }
      }
      if (found) return true;
    } catch (e) {
      statusCallback("Ortadaki 'New Post' butonu bulunamadı, diğer yöntemler deneniyor...");
    }
    // Eski yöntemlerle devam
    statusCallback("Post oluşturma butonu aranıyor...");
    try {
      await page.waitForXPath(
        "//button[contains(text(), 'Create your next post')]",
        { timeout: timeout }
      );
      const [createPostButton] = await page.$x(
        "//button[contains(text(), 'Create your next post')]"
      );
      if (createPostButton) {
        await createPostButton.click();
        statusCallback("Post oluşturma butonu tıklandı");
        return true;
      }
    } catch (error) {
      statusCallback(
        "Post oluşturma butonu bulunamadı. Alternatif yöntem deneniyor..."
      );
      // Doğrudan compose sayfasına gitmeyi dene
      try {
        statusCallback("Compose sayfasına yönlendiriliyor...");
        await page.goto("https://publish.buffer.com/compose", {
          waitUntil: "networkidle2",
          timeout: timeout,
        });
        statusCallback("Compose sayfası yüklendi");
        return true;
      } catch (navError) {
        statusCallback(
          "Compose sayfasına yönlendirme başarısız: " + navError.message
        );
      }
    }
  } catch (error) {
    statusCallback("Post oluşturma sırasında hata: " + error.message);
  }
  return false;
}

/**
 * Postu taslak olarak kaydeder
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {boolean} Başarılı ise true, değilse false
 */
async function saveAsDraft(page, timeout, statusCallback) {
  try {
    statusCallback("Post taslak olarak kaydediliyor...");
    await page.waitForSelector('button[data-testid="draft-save-buttons"]', {
      timeout: timeout,
    });
    await page.click('button[data-testid="draft-save-buttons"]');
    statusCallback("Taslak kaydetme butonuna tıklandı, 3 saniye bekleniyor...");
    await page.waitForTimeout(3000); // Ekstra bekleme
    // Doğrulama: Taslaklar sekmesinde post görünüyor mu?
    try {
      statusCallback("Taslaklar sekmesi kontrol ediliyor...");
      await page.goto('https://publish.buffer.com/drafts', { waitUntil: 'networkidle2', timeout: timeout });
      await page.waitForTimeout(2000);
      const postExists = await page.evaluate(() => {
        const posts = Array.from(document.querySelectorAll('div[data-testid="post-preview"]'));
        return posts.length > 0;
      });
      if (postExists) {
        statusCallback("Taslak başarıyla kaydedildi ve listede görünüyor.");
      } else {
        statusCallback("Uyarı: Taslak kaydedildi ama listede görünmüyor!");
      }
    } catch (e) {
      statusCallback("Taslak doğrulama sırasında hata oluştu: " + e.message);
    }
    return true;
  } catch (error) {
    statusCallback("Taslak kaydetme adımlarında hata oluştu: " + error.message);
    return false;
  }
}

/**
 * Postu kuyruğa ekler
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function addToQueue(page, timeout, statusCallback) {
  try {
    statusCallback("Post kuyruğa eklenmeden önce 'Customize for each network' butonuna tıklanıyor...");
    await page.waitForSelector('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E', { timeout: timeout });
    await page.click('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E');
    statusCallback("'Customize for each network' butonuna tıklandı");
    await page.waitForTimeout(1000);
    return await saveAsDraft(page, timeout, statusCallback);
  } catch (error) {
    statusCallback("Kuyruğa ekleme adımlarında hata oluştu: " + error.message);
    return false;
  }
}

/**
 * Postu doğrudan paylaşır
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {boolean} Başarılı ise true, değilse false
 */
async function publishNow(page, timeout, statusCallback) {
  try {
    statusCallback("Post paylaşılmadan önce 'Customize for each network' butonuna tıklanıyor...");
    await page.waitForSelector('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E', { timeout: timeout });
    await page.click('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E');
    statusCallback("'Customize for each network' butonuna tıklandı");
    await page.waitForTimeout(1000);
    statusCallback("Post paylaşılıyor...");
    const publishSelector = 'button[data-testid="publish-button"]';
    await page.waitForSelector(publishSelector, {
      timeout: timeout,
    });
    await page.click(publishSelector);
    statusCallback("Post başarıyla paylaşıldı");
    return true;
  } catch (error) {
    statusCallback("Paylaşım adımlarında hata oluştu: " + error.message);
    return false;
  }
}

module.exports = {
  login,
  openComposePage,
  addToQueue,
  saveAsDraft,
  publishNow,
};
