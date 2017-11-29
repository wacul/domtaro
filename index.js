const puppeteer = require("puppeteer");
const defaultOptions = {
  browser: null,
  launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-http2"] },
  gotoOptions: { waitUntil: "networkidle2" },
  emulateOptions: {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  },
  pageInitializer: async browser => await browser.newPage(),
  evaluates: [],
};
module.exports.defaultOptions = defaultOptions;

async function wait() {
  await new Promise(resolve => setTimeout(resolve, 100));
  await new Promise(resolve => window.requestIdleCallback(resolve, { timeout: 5000 }));
}

function getDocumentHeight() {
  return document.documentElement.scrollHeight;
}

function fixCharset() {
  const metaCharset = document.querySelector("meta[charset]");
  if (metaCharset && metaCharset.charset) metaCharset.charset = "UTF-8";
  const metaHttpEquiv = document.querySelector("meta[http-equiv=content-type]");
  if (metaHttpEquiv && metaHttpEquiv.content) metaHttpEquiv.content = "text/html; charset=UTF-8";
}

module.exports.snapshot = async (url, options = {}) => {
  const launchOptions = { ...defaultOptions.launchOptions, ...options.launchOptions };
  const gotoOptions = { ...defaultOptions.gotoOptions, ...options.gotoOptions };
  const emulateOptions = { ...defaultOptions.emulateOptions, ...options.emulateOptions };
  const browser = options.browser || await puppeteer.launch(launchOptions);

  const page = await (options.pageInitializer || defaultOptions.pageInitializer)(browser);
  await page.emulate(emulateOptions);
  await page.goto(url, gotoOptions);
  await page.evaluate(wait);
  const h = await page.evaluate(getDocumentHeight);
  await page.emulate({
    userAgent: emulateOptions.userAgent,
    viewport: {
      width: emulateOptions.viewport.width,
      height: h,
    },
  });
  await page.evaluate(wait);

  const evaluates = options.evaluates || defaultOptions.evaluates;
  for (let i = 0; i < evaluates.length; i++) {
    await evaluates[i](page);
  }
  await page.evaluate(fixCharset);

  const str = await page.evaluate(async () => {
    [...document.querySelectorAll("link, a")].forEach(el => { if (el.href) el.href = el.href; });
    [...document.querySelectorAll("img, video, audio")].forEach(el => { if (el.src) el.src = el.src; });
    [...document.querySelectorAll("script, noscript")].forEach(el => el.remove());
    [...document.querySelectorAll("iframe")].forEach(el => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      if (computed.display === "none") el.remove();
      if (rect.width < 5 || rect.height < 5) el.remove();
    });

    const domEvents = Object.getOwnPropertyNames(HTMLElement.prototype).filter(name => name.startsWith("on"));
    [...document.querySelectorAll("*")].forEach(el => {
      domEvents.forEach(name => el.hasAttribute(name) && el.removeAttribute(name));
    });
    const img = new Image();
    return document.documentElement.outerHTML
      .replace(/url\(([^)]+)\)/g, (all, src) => {
        img.src = src.replace(/^['"]/, "").replace(/['"]$/, "");
        return `url(${img.src})`;
      });
  });

  return str;
};
