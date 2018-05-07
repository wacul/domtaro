const puppeteer = require("puppeteer");
const defaultOptions = {
  browser: null,
  launchOptions: {
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-http2"]
  },
  gotoOptions: { waitUntil: "networkidle2" },
  emulateOptions: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36",
    viewport: { width: 1280, height: 800 }
  },
  screenshotOptions: {},
  pageInitializer: async (browser, url, opts) => {
    const page = await browser.newPage();
    await page.emulate(opts.emulateOptions);
    await page.goto(url, opts.gotoOptions);
    await page.evaluate(wait);
    const h = await page.evaluate(getDocumentHeight);
    await page.emulate({
      userAgent: opts.emulateOptions.userAgent,
      viewport: {
        width: opts.emulateOptions.viewport.width,
        height: h,
        deviceScaleFactor: opts.emulateOptions.viewport.deviceScaleFactor || 1
      }
    });
    await page.evaluate(wait);
    return page;
  },
  evaluates: []
};
module.exports.defaultOptions = defaultOptions;

async function wait(t = 100) {
  await new Promise(resolve => setTimeout(resolve, t));
  await new Promise(resolve => window.requestIdleCallback(resolve, { timeout: 5000 }));
}

function getDocumentHeight() {
  return document.documentElement.scrollHeight;
}

function fixCharset() {
  const metaCharset = document.querySelector("meta[charset]");
  if (metaCharset) metaCharset.setAttribute("charset", "UTF-8");
  const metaHttpEquiv = document.querySelector("meta[http-equiv=content-type]");
  if (metaHttpEquiv) metaHttpEquiv.setAttribute("content", "text/html; charset=UTF-8");
}

module.exports.snapshot = async (url, options = {}) => {
  const launchOptions = {
    ...defaultOptions.launchOptions,
    ...options.launchOptions
  };
  const gotoOptions = { ...defaultOptions.gotoOptions, ...options.gotoOptions };
  const emulateOptions = {
    ...defaultOptions.emulateOptions,
    ...options.emulateOptions
  };

  let browser = options.browser;
  let page;
  let str = "";
  try {
    if (options.pageInitializer) {
      page = await options.pageInitializer(browser, url, {
        launchOptions,
        gotoOptions,
        emulateOptions
      });
    } else {
      browser = await puppeteer.launch(launchOptions);
      page = await defaultOptions.pageInitializer(browser, url, {
        launchOptions,
        gotoOptions,
        emulateOptions
      });
    }
    const evaluates = options.evaluates || defaultOptions.evaluates;
    for (let i = 0; i < evaluates.length; i++) {
      await evaluates[i](page);
    }
    await page.evaluate(fixCharset);

    str = await page.evaluate(async () => {
      [...document.querySelectorAll("[href]")].forEach(el => {
        if (el.href) el.href = el.href;
      });
      [...document.querySelectorAll("a")].forEach(el => (el.target = "_blank"));
      [...document.querySelectorAll("[src]")].forEach(el => {
        if (el.src) el.src = el.src;
      });
      [...document.querySelectorAll("script, noscript, link[rel=preload]")].forEach(el => el.remove());
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
      return document.documentElement.outerHTML.replace(/url\(([^)]+)\)/g, (all, src) => {
        src = src.replace(/(['"]|&quot;)/g, "");
        if (src.startsWith("#")) return `url(${src})`;
        img.src = src;
        return `url(${img.src})`;
      });
    });
  } catch (e) {
    throw e;
  } finally {
    if (!options.browser && browser) await browser.close();
  }
  return "<!doctype html>" + str;
};

module.exports.screenshot = async (url, options = {}) => {
  const launchOptions = {
    ...defaultOptions.launchOptions,
    ...options.launchOptions
  };
  const gotoOptions = { ...defaultOptions.gotoOptions, ...options.gotoOptions };
  const emulateOptions = {
    ...defaultOptions.emulateOptions,
    ...options.emulateOptions
  };
  const screenshotOptions = {
    ...defaultOptions.screenshotOptions,
    ...options.screenshotOptions
  };

  let browser = options.browser;
  let page;
  let buff;
  try {
    if (options.pageInitializer) {
      page = await options.pageInitializer(browser, url, {
        launchOptions,
        gotoOptions,
        emulateOptions
      });
    } else {
      browser = await puppeteer.launch(launchOptions);
      page = await defaultOptions.pageInitializer(browser, url, {
        launchOptions,
        gotoOptions,
        emulateOptions
      });
    }
    const evaluates = options.evaluates || defaultOptions.evaluates;
    for (let i = 0; i < evaluates.length; i++) {
      await evaluates[i](page);
    }
    if (screenshotOptions.clip) {
      const documentHeight = await page.evaluate(getDocumentHeight);
      screenshotOptions.clip.y = Math.max(screenshotOptions.clip.y, 0);
      const h = screenshotOptions.clip.y + screenshotOptions.clip.height;
      if (h > documentHeight) {
        screenshotOptions.clip.height = documentHeight - screenshotOptions.clip.y;
      }
    }
    buff = await page.screenshot(screenshotOptions);
  } catch (e) {
    throw e;
  } finally {
    if (!options.browser && browser) await browser.close();
  }
  return buff;
};
