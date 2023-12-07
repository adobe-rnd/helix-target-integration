// Create a performance mark
window.createPerfMark = (name) => {
  performance.mark(`perf-start-${name}`);
  console.log(`perf-${name} started at ${performance.now()} + ms`);
};

// Measure the time between two performance marks
window.measurePerfMark = (name) => {
  performance.mark(`perf-stop-${name}`);
  const duration = performance.measure(`perf-${name}`, `perf-start-${name}`, `perf-stop-${name}`);
  console.log(`perf-${name} stopped at ${performance.now()} ms`);
  console.log(`perf-${name} took ${duration.duration} ms`);
};

function uuid() {
  let d = new Date().getTime();
  let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;// Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 *
 */
function fetchOffers(client, host) {
  window.createPerfMark('fetch-offers');
  const url = `https://${client}.tt.omtrdc.net/rest/v1/delivery?client=${client}&sessionId=${uuid()}`;
  const payload = {
    context: {
      channel: 'web',
      browser: {
        host,
      },
      address: {
        url: host,
      },
    },
    execute: {
      pageLoad: {},
    },
  };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cache-control': 'no-cache',
    },
    body: JSON.stringify(payload),
  };
  return fetch(url, options)
    .then((response) => response.json())
    .then((data) => data?.execute?.pageLoad?.options?.reduce(
      (acc, option) => {
        if (option.type === 'actions') {
          return option.content.reduce((acc, content) => {
            if (content.type === 'setHtml') {
              acc = [...acc, content];
            }
            return acc;
          }, acc);
        }
        return acc;
      },
      [],
    )).then((offers) => {
      window.measurePerfMark('fetch-offers');
      // window.measurePerfMark('targeting: loading offers');
      return offers;
    });
}

function getDecoratedMain() {
  return new Promise((resolve) => {
    if (document.body.classList.contains('appear')) {
      console.log('main already decorated');
      resolve(document.body.querySelector('main'));
    }
    const config = { attributes: true, attributeFilter: ['class'] };
    const observer = new MutationObserver((mutations, observer) => {
      if (document.body.classList.contains('appear')) {
        console.log('main decorated');
        observer.disconnect();
        resolve(document.body.querySelector('main'));
      }
    });
    observer.observe(document.body, config);
  });
}

/**
 * Get all sections that are already loaded.
 */
function getLoadedSections(main) {
  const sections = main.querySelectorAll('.section');
  return Array.from(sections).map((section) => {
    console.log('checking section', section);
    return new Promise((resolve) => {
      if (section.getAttribute('data-section-status') === 'loaded') {
        console.log('section already loaded', section);
        resolve(section);
      }
      const config = { attributes: true, attributeFilter: ['data-section-status'] };
      const observer = new MutationObserver((mutations, observer) => {
        console.log('section loaded', section);
        if (section.getAttribute('data-section-status') === 'loaded') {
          observer.disconnect();
          resolve(section);
        }
      });
      observer.observe(section, config);
    });
  });
}

/**
 * Render offers in a section.
 */
function renderOffers(section, decisions) {
  decisions.forEach((decision) => {
    const { type, selector, content } = decision;
    if (type === 'setHtml') {
      const targetElement = section.querySelector(selector);
      if (targetElement) {
        targetElement.innerHTML = content;
        section.style.visibility = 'visible';
        console.log('section rendered', section);
        console.log('Hello World');
        window.measurePerfMark(`targeting: rendering section: ${Array.from(section.classList).join('_')}`);
      }
    }
  });
}

function getSectionForSelector(selector) {
  let section = document.querySelector(selector);
  while (section && !section.classList.contains('section')) {
    section = section.parentNode;
  }
  return section;
}

/**
 * Start targeting for a client on a host.
 */
export default function startTargeting(client, host) {
  console.log(`start targeting for ${client} on ${host}`);
  window.createPerfMark('targeting: pre-hiding');
  window.createPerfMark('targeting: loading offers');
  document.body.style.visibility = 'hidden';
  const offersPromise = fetchOffers(client, host);
  getDecoratedMain().then(async (main) => {
    const offers = await offersPromise;
    console.log('offers', offers);
    window.measurePerfMark('targeting: loading offers');

    offers.forEach((offer) => {
      const section = getSectionForSelector(offer.selector);
      if (section) {
        console.log(`hiding section ${section.id} for ${offer.selector} offer`);
        section.style.visibility = 'hidden';
        window.createPerfMark(`targeting: rendering section: ${Array.from(section.classList).join('_')}`);
      }
      console.log('offer', offer);
    });
    document.body.style.visibility = 'visible';
    window.measurePerfMark('targeting: pre-hiding');
    Promise.all(getLoadedSections(main).map(async (sectionPromise) => {
      const section = await sectionPromise;
      console.log('section ready to render', section);
      renderOffers(section, offers);
    })).then(() => {
      // document.body.style.visibility = 'visible';
      // window.measurePerfMark('targeting: all');
    });
  });
}
