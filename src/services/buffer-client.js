const puppeteer = require('puppeteer');

// page.waitForTimeout(x) yerine kullanılacak fonksiyon
async function waitForTimeout(ms) {
  return new Promise(res => setTimeout(res, ms));
}

let browser = null;
let isLoggedIn = false;

async function login(page, email, password, statusCallback) {
    try {
        if (isLoggedIn) {
            statusCallback("Buffer oturumu zaten açık, giriş atlanıyor...");
            return;
        }

        if (!browser) {
            statusCallback("Yeni bir tarayıcı oturumu başlatılıyor...");
            try {
                browser = await puppeteer.launch({
                    product: 'chrome',
                    channel: 'chrome',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080'
                    ],
                    headless: false,
                    ignoreHTTPSErrors: true,
                    timeout: 60000
                });
                statusCallback("Tarayıcı başarıyla başlatıldı");
            } catch (error) {
                statusCallback(`Tarayıcı başlatma hatası: ${error.message}`);
                throw error;
            }
        }

        statusCallback("Buffer'a giriş yapılıyor...");
        await page.goto(
            "https://login.buffer.com/login?plan=free&cycle=year&cta=bufferSite-globalNav-login-1",
            { 
                waitUntil: "networkidle2",
                timeout: 60000 
            }
        );

        // Sayfanın tam olarak yüklenmesi için bekle
        await waitForTimeout(5000);

        // Yeni seçicileri dene
        const emailSelectors = [
            'input[name="email"]',
            'input[type="email"]',
            'input[placeholder*="email" i]',
            'input[placeholder*="e-posta" i]',
            'input[data-testid="email-input"]'
        ];

        const passwordSelectors = [
            'input[name="password"]',
            'input[type="password"]',
            'input[placeholder*="password" i]',
            'input[placeholder*="şifre" i]',
            'input[data-testid="password-input"]'
        ];

        let emailInput = null;
        let passwordInput = null;

        // E-posta alanını bul
        for (const selector of emailSelectors) {
            try {
                emailInput = await page.$(selector);
                if (emailInput) {
                    statusCallback(`E-posta alanı bulundu: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        // Şifre alanını bul
        for (const selector of passwordSelectors) {
            try {
                passwordInput = await page.$(selector);
                if (passwordInput) {
                    statusCallback(`Şifre alanı bulundu: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!emailInput || !passwordInput) {
            throw new Error("Giriş alanları bulunamadı!");
        }

        // Giriş bilgilerini gir
        await emailInput.type(email, { delay: 100 });
        await passwordInput.type(password, { delay: 100 });
        await page.keyboard.press("Enter");

        statusCallback("Buffer'a giriş yapıldı, sayfa yükleniyor...");
        await page.waitForNavigation({ waitUntil: "networkidle2" });
        isLoggedIn = true;

        // Buffer açıldığında popup çıkarsa X (kapat) butonuna tıkla
        await waitForTimeout(2000);
        // Öncelikli olarak Buffer'ın yeni popup X butonunu dene
        let closeBtn = await page.$('button.publish_close_ObJJi');
        if (!closeBtn) {
            // Eski veya farklı popup'lar için genel close butonlarını dene
            closeBtn = await page.$('button[aria-label="Close"], button.close, .close, button[title="Close"], button[aria-label="Dismiss"], button[aria-label="close"]');
        }
        if (closeBtn) {
            await closeBtn.click();
            await waitForTimeout(2000); // Kapatma sonrası bekle
            statusCallback("Buffer popup'ı varsa X ile kapatıldı ve 2 sn beklendi");
        } else {
            statusCallback("Buffer popup'ı bulunamadı veya kapatılacak popup yok");
        }
    } catch (error) {
        statusCallback("Giriş yapılırken hata oluştu: " + error.message);
        throw error;
    }
}

/**
 * Kompozisyon sayfasını açar
 * @param {Object} page Puppeteer sayfası
 * @param {number} elementTimeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 */
async function openComposePage(page, elementTimeout, statusCallback) {
  try {
    statusCallback("Buffer'ın ana sayfasına yönlendiriliyor...");
    await page.goto("https://publish.buffer.com/all-channels", {
      waitUntil: "networkidle2",
    });

    statusCallback("Ortadaki mavi 'New Post' butonu aranıyor...");
    const buttons = await page.$$('button');
    let found = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.trim() === 'New Post') {
        await btn.click();
        statusCallback("'New Post' butonuna tıklandı (ortadaki mavi buton)");
        await waitForTimeout(2000);
        found = true;
        break;
      }
    }
    if (!found) {
      statusCallback("'New Post' butonu bulunamadı (ortadaki mavi)!");
      return false;
    }
    statusCallback("Kompozisyon sayfası açıldı");
    return true;
  } catch (error) {
    statusCallback(`Kompozisyon sayfası açma hatası: ${error.message}`);
    console.error("Kompozisyon sayfası açma hatası:", error);
    return false;
  }
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
    statusCallback("Taslak kaydedildi");
    await page.waitForTimeout(1000); // Kısa bir bekleme
    return true;
  } catch (error) {
    statusCallback("Taslak kaydetme sırasında hata oluştu: " + error.message);
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
    const customizeBtn = await page.$('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E');
    if (!customizeBtn) {
      statusCallback("'Customize for each network' butonu bulunamadı!");
      return false;
    }
    await customizeBtn.click();
    statusCallback("'Customize for each network' butonuna tıklandı");
    await page.waitForTimeout(2000);

    // Add to Queue butonunu bul ve tıkla
    statusCallback("'Add to Queue' butonu aranıyor...");
    await page.waitForSelector('button[data-testid="stacked-save-buttons"]', { timeout: timeout });
    const addToQueueBtn = await page.$('button[data-testid="stacked-save-buttons"]');
    if (!addToQueueBtn) {
      statusCallback("'Add to Queue' butonu bulunamadı!");
      return false;
    }
    await addToQueueBtn.click();
    statusCallback("'Add to Queue' butonuna tıklandı");
    await page.waitForTimeout(2000);

    // Publish Now butonlarını bul ve hepsine tıkla
    while (true) {
      statusCallback("'Publish Now' butonu aranıyor...");
      const publishNowBtn = await page.$('button.publish_base_GTmOA.publish_base_9SxrA.publish_medium_mA1GB.publish_secondary_-bRVa');
      if (!publishNowBtn) {
        statusCallback("'Publish Now' butonu bulunamadı, işlem tamamlandı.");
        break;
      }
      await publishNowBtn.click();
      statusCallback("'Publish Now' butonuna tıklandı");
      await page.waitForTimeout(2000);
    }

    statusCallback("Post başarıyla kuyruğa eklendi");
    return true;
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
    statusCallback("Buffer kuyruğu sekmesine gidiliyor...");
    await page.goto("https://publish.buffer.com/all-channels?tab=queue", { waitUntil: "networkidle2" });
    await page.waitForTimeout(2000);

    statusCallback("Post paylaşılmadan önce 'Customize for each network' butonuna tıklanıyor...");
    await page.waitForSelector('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E', { timeout: timeout });
    const customizeBtn = await page.$('button[data-testid="omnibox-buttons"], button.publish_customizeButton_yRB5E');
    if (!customizeBtn) {
      statusCallback("'Customize for each network' butonu bulunamadı!");
      return false;
    }
    await customizeBtn.click();
    statusCallback("'Customize for each network' butonuna tıklandı");
    await page.waitForTimeout(2000);

    // Add to Queue butonunu bul ve tıkla
    statusCallback("'Add to Queue' butonu aranıyor...");
    await page.waitForSelector('button[data-testid="stacked-save-buttons"]', { timeout: timeout });
    const addToQueueBtn = await page.$('button[data-testid="stacked-save-buttons"]');
    if (!addToQueueBtn) {
      statusCallback("'Add to Queue' butonu bulunamadı!");
      return false;
    }
    await addToQueueBtn.click();
    statusCallback("'Add to Queue' butonuna tıklandı");
    await page.waitForTimeout(2000);

    // Share Now seçeneğini bul ve tıkla
    statusCallback("'Share Now' seçeneği aranıyor...");
    await page.waitForSelector('#SHARE_NOW', { timeout: timeout });
    const shareNowBtn = await page.$('#SHARE_NOW');
    if (!shareNowBtn) {
      statusCallback("'Share Now' seçeneği bulunamadı!");
      return false;
    }
    await shareNowBtn.click();
    statusCallback("'Share Now' seçeneğine tıklandı");
    await page.waitForTimeout(2000);

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

