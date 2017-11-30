const puppeteer = require("puppeteer");
const defaultOptions = {
  browser: null,
  launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-http2"] },
  gotoOptions: { waitUntil: "networkidle2" },
  emulateOptions: {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  },
  pageInitializer: async browser => {
    const page = await browser.newPage();
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
    return page;
  },
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

  let browser = options.browser;
  let page;
  if (options.pageInitializer) {
    page = await options.pageInitializer(browser, {
      launchOptions,
      gotoOptions,
      emulateOptions,
    });
  } else {
    browser = await puppeteer.launch(launchOptions);
    page = await defaultOptions.pageInitializer(browser, {
      launchOptions,
      gotoOptions,
      emulateOptions,
    });
  }
  const evaluates = options.evaluates || defaultOptions.evaluates;
  for (let i = 0; i < evaluates.length; i++) {
    await evaluates[i](page);
  }
  await page.evaluate(fixCharset);

  const str = await page.evaluate(async () => {
    [...document.querySelectorAll("[href]")].forEach(el => { if (el.href) el.href = el.href; });
    [...document.querySelectorAll("a")].forEach(el => el.target = "_blank");
    [...document.querySelectorAll("[src]")].forEach(el => { if (el.src) el.src = el.src; });
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

  if (!options.browser && browser) await browser.close();
  return str;
};
