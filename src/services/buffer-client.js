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

  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await page.keyboard.press("Enter");

  statusCallback("Buffer'a giriş yapıldı, sayfa yükleniyor...");
  await page.waitForNavigation({ waitUntil: "networkidle2" });
}

/**
 * Kompozisyon sayfasını açar
 * @param {Object} page Puppeteer sayfası
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function openComposePage(page, timeout, statusCallback) {
  try {
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
    statusCallback("Post taslak olarak kaydedildi");
    return true;
  } catch (error) {
    statusCallback("Taslak kaydetme butonu bulunamadı");
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
    statusCallback("Post kuyruğa ekleniyor...");

    // 1. Yöntem: Dropdown menüyü açma
    try {
      const dropdownSelector =
        'button[data-testid="post-composer-schedule-dropdown"]';
      await page.waitForSelector(dropdownSelector, { timeout: timeout });
      await page.click(dropdownSelector);

      const queueOptionSelector = 'div[data-testid="add-to-queue-option"]';
      await page.waitForSelector(queueOptionSelector, { timeout: timeout });
      await page.click(queueOptionSelector);

      statusCallback("Post kuyruğa eklendi");
      return true;
    } catch (dropdownError) {
      statusCallback(
        "Dropdown menü bulunamadı, alternatif yöntem deneniyor..."
      );
    }

    // 2. Yöntem: Doğrudan Queue butonu
    try {
      const queueButtonSelector = 'button[data-testid="queue-button"]';
      await page.waitForSelector(queueButtonSelector, { timeout: timeout });
      await page.click(queueButtonSelector);

      statusCallback("Post kuyruğa eklendi");
      return true;
    } catch (queueButtonError) {
      statusCallback("Queue butonu bulunamadı, alternatif yöntem deneniyor...");
    }

    // 3. Yöntem: Metin içeren buton
    try {
      await page.waitForXPath('//button[contains(., "Add to Queue")]', {
        timeout: timeout,
      });
      const [addToQueueButton] = await page.$x(
        '//button[contains(., "Add to Queue")]'
      );
      if (addToQueueButton) {
        await addToQueueButton.click();
        statusCallback("Post kuyruğa eklendi");
        return true;
      }
    } catch (textButtonError) {
      statusCallback(
        "Add to Queue butonu bulunamadı, taslak olarak kaydediliyor..."
      );
      return await saveAsDraft(page, timeout, statusCallback);
    }
  } catch (error) {
    statusCallback("Kuyruğa ekleme hatası: " + error.message);
    return await saveAsDraft(page, timeout, statusCallback);
  }
  return false;
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
    statusCallback("Post paylaşılıyor...");
    const publishSelector = 'button[data-testid="publish-button"]';
    await page.waitForSelector(publishSelector, {
      timeout: timeout,
    });
    await page.click(publishSelector);
    statusCallback("Post başarıyla paylaşıldı");
    return true;
  } catch (error) {
    statusCallback("Paylaşım butonu bulunamadı, kuyruğa ekleniyor...");
    return await addToQueue(page, timeout, statusCallback);
  }
}

module.exports = {
  login,
  openComposePage,
  addToQueue,
  saveAsDraft,
  publishNow,
};
