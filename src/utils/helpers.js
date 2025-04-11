/**
 * Hesap URL'sini temizler ve formatlar
 * @param {string} accountUrl Ham hesap URL'si veya kullanıcı adı
 * @returns {string} Biçimlendirilmiş URL
 */
function formatAccountUrl(accountUrl) {
  if (!accountUrl) return "";

  let formattedAccountUrl = accountUrl.trim();

  // @ ile başlıyorsa, @ işaretini kaldır
  if (formattedAccountUrl.startsWith("@")) {
    formattedAccountUrl = formattedAccountUrl.substring(1);
  }

  // https:// ile başlamıyorsa, X.com URL'sine dönüştür
  if (!formattedAccountUrl.startsWith("https://")) {
    formattedAccountUrl = `https://x.com/${formattedAccountUrl.replace(
      "https://x.com/",
      ""
    )}`;
  }

  return formattedAccountUrl;
}

/**
 * Tweet inceleme için konsol günlüğü göster
 * @param {object} tweet Tweet nesnesi
 */
function logTweetDetails(tweet) {
  console.log("Tweet detayları:", {
    url: tweet.url,
    isPinned: tweet.isPinned,
    date: tweet.date,
    time: tweet.time,
  });
}

module.exports = {
  formatAccountUrl,
  logTweetDetails,
};
