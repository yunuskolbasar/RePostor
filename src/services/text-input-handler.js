/**
 * Metin kutusuna yazı yazmak için seçiciler
 * @type {Array<string>}
 */
const TEXT_SELECTORS = [
  'div[role="textbox"]',
  'div[data-testid="composer-textarea"]',
  'div[contenteditable="true"]',
  ".composer-editor",
  ".text-area",
  ".textarea",
  'div[class*="composer"]',
  'div[class*="textarea"]',
  'div[contentEditable="true"]',
];

/**
 * Metin kutusuna yazı yazar
 * @param {Object} page Puppeteer sayfası
 * @param {string} text Yazılacak metin
 * @param {number} timeout Zaman aşımı
 * @param {Function} statusCallback Durum güncellemesi callback'i
 * @returns {boolean} Başarılı ise true, değilse false
 */
async function typeTextIntoComposer(page, text, timeout, statusCallback) {
  try {
    statusCallback("Tweet metni ekleniyor...");

    // Buffer arayüzünün yüklenmesi için bekle
    await waitForTimeout(8000);

    // Debug için sayfa içeriğini logla
    statusCallback("Sayfa yapısı inceleniyor...");
    const pageContent = await page.content();
    console.log(
      "Sayfa içeriği (ilk 5000 karakter):",
      pageContent.substring(0, 5000)
    );

    for (const selector of TEXT_SELECTORS) {
      try {
        statusCallback(`Metin kutusu aranıyor: ${selector}...`);

        // Seçiciyi görünür olana kadar bekle
        const element = await page.waitForSelector(selector, {
          timeout: timeout * 2,
          visible: true,
        });

        if (!element) continue;

        // Element görünür mü kontrol et
        const isVisible = await isElementVisible(page, selector);
        if (!isVisible) {
          console.log(`${selector} görünür değil, sonraki deneniyor`);
          continue;
        }

        // Elemana tıkla ve metni temizle
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press("Backspace");

        // Klavye girişi ile yaz
        statusCallback("Metin ekleniyor (klavye simülasyonu)...");
        await page.type(selector, text, { delay: 10 });

        // JavaScript ile de değer ata ve olayları tetikle
        await injectTextViaJS(page, selector, text);

        // İçerik kontrolü
        if (await verifyTextWasEntered(page, selector)) {
          statusCallback(`Metin kutusu bulundu ve içerik eklendi: ${selector}`);
          return true;
        } else {
          statusCallback(
            `Metin kutusu bulundu, ancak içerik eklenemedi: ${selector}`
          );
        }
      } catch (err) {
        console.error(`${selector} için hata:`, err.message);
      }
    }

    // Tüm seçiciler başarısız oldu
    return false;
  } catch (error) {
    statusCallback(`Metin kutusu hatası: ${error.message}`);
    return false;
  }
}

/**
 * Element görünür mü kontrol eder
 */
async function isElementVisible(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;

    const style = window.getComputedStyle(el);
    return (
      style &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }, selector);
}

/**
 * JavaScript ile metin ekler
 */
async function injectTextViaJS(page, selector, text) {
  return page.evaluate(
    (selector, text) => {
      const element = document.querySelector(selector);
      if (!element) return false;

      // Değeri değiştir
      if (element.contentEditable === "true") {
        element.innerText = text;
      } else if ("value" in element) {
        element.value = text;
      } else {
        element.textContent = text;
      }

      // Olayları tetikle
      [
        "input",
        "change",
        "keyup",
        "keydown",
        "keypress",
        "blur",
        "focus",
      ].forEach((eventType) => {
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
      });

      // React olayları için özel
      if (element._valueTracker) {
        element._valueTracker.setValue("");
      }

      return true;
    },
    selector,
    text
  );
}

/**
 * Metnin girişinin doğrula
 */
async function verifyTextWasEntered(page, selector) {
  // Bir süre bekle
  await page.waitForTimeout(2000);

  // Metin alanının içeriğini kontrol et
  const inputContent = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return el ? el.innerText || el.value || el.textContent : null;
  }, selector);

  console.log(`Metin kontrolü: '${inputContent || "boş"}'`);
  return inputContent && inputContent.length > 0;
}

module.exports = {
  typeTextIntoComposer,
  TEXT_SELECTORS,
};
