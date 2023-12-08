import { createPerformanceMark, measurePerformance } from './benchmark.js';

const SESSION_COOKIE_NAME = 'sessionId';
const SESSION_COOKIE_EXPIRATION_DAYS = 7;

/**
 * Generate a UUID.
 * @returns {string}
 */
function uuid() {
  return `sess-${Math.random()
    .toString(36)
    .substring(2, 9)}-${Date.now()
    .toString(36)}`;
}

/**
 * Get a cookie by name.
 * @param name
 * @returns {string}
 */
function getCookie(name) {
  const cookies = document.cookie.split(';');
  return cookies.find((cookie) => {
    const [key, value] = cookie.split('=');
    return key.trim() === name && value;
  });
}

/**
 * Set a cookie.
 * @param name
 * @param value
 * @param days
 */
function setCookie(name, value, days) {
  document.cookie = `${name}=${value}; max-age=${days * 24 * 60 * 60}; path=/`;
}

/**
 * Get the session ID.
 * @returns {string}
 */
function getOrCreateSessionId() {
  const existingSessionId = getCookie(SESSION_COOKIE_NAME);
  if (existingSessionId) {
    return existingSessionId;
  }
  const newSessionId = uuid();
  setCookie(SESSION_COOKIE_NAME, newSessionId, SESSION_COOKIE_EXPIRATION_DAYS);
  return newSessionId;
}

/**
 * Get all offers from a response.
 * @param data
 * @returns {*[]}
 */
function getApplicableOffers(data) {
  const offers = [];
  const options = data.execute?.pageLoad?.options ?? [];
  console.debug(`received ${options.length} options`); // eslint-disable-line no-console
  options.forEach((option) => {
    if (option.type === 'actions') {
      option.content.forEach((content) => {
        if (content.type === 'setHtml') {
          offers.push(content);
        }
      });
    }
  });
  return offers;
}

/**
 * Fetch offers for a client and a host.
 * @param client
 * @param host
 * @param sessionId
 * @returns {Promise<any>}
 */
async function fetchOffers(client, host, sessionId) {
  const url = `https://${client}.tt.omtrdc.net/rest/v1/delivery?client=${client}&sessionId=${sessionId}`;

  const payload = {
    context: {
      channel: 'web',
      address: {
        url: host,
      },
    },
    property: {
      token: 'dev-helix-target-integration',
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

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch offers: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  return getApplicableOffers(data);
}

/**
 * Get the main element after it is decorated.
 */
function getDecoratedContent() {
  return new Promise((resolve) => {
    if (document.body.classList.contains('appear')) {
      // eslint-disable-next-line no-console
      console.debug('content is already decorated... resolving immediately');
      resolve(document.body.querySelector('main'));
    }
    const config = {
      attributes: true,
      attributeFilter: ['class'],
    };
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('appear')) {
        // eslint-disable-next-line no-console
        console.debug('content has been decorated... resolving');
        observer.disconnect();
        resolve(document.body.querySelector('main'));
      }
    });
    observer.observe(document.body, config);
  });
}

/**
 * Get all sections that are already loaded.
 * @param main The main element.
 */
function getLoadedSections(main) {
  const sections = main.querySelectorAll('.section');
  return Array.from(sections)
    .map((section) => new Promise((resolve) => {
      if (section.getAttribute('data-section-status') === 'loaded') {
        // eslint-disable-next-line no-console
        console.debug('section is already loaded... resolving immediately', section);
        resolve(section);
      }
      const config = {
        attributes: true,
        attributeFilter: ['data-section-status'],
      };
      const observer = new MutationObserver(() => {
        if (section.getAttribute('data-section-status') === 'loaded') {
          // eslint-disable-next-line no-console
          console.debug('section has been loaded... resolving', section);
          observer.disconnect();
          resolve(section);
        }
      });
      observer.observe(section, config);
    }));
}

/**
 * Render offers in a section.
 * @param section The section.
 * @param offers The offers.
 */
function displayOffers(section, offers) {
  offers.forEach((offer) => {
    const { type, selector, content } = offer;
    if (type === 'setHtml') {
      const targetElement = section.querySelector(selector);
      if (targetElement) {
        targetElement.innerHTML = content;
        // eslint-disable-next-line no-console
        console.debug('section has been rendered', section);
        measurePerformance(
          `targeting:rendering-section:${Array.from(section.classList).join('_')}`,
        );
      }
    }
  });
  if (section.style.visibility === 'hidden') {
    // eslint-disable-next-line no-console
    console.debug('revealing section', section);
    section.style.visibility = 'visible';
  }
}

/**
 * Get the section for a selector.
 * @param selector The element selector.
 */
function getSectionByElementSelector(selector) {
  let section = document.querySelector(selector);
  while (section && !section.classList.contains('section')) {
    section = section.parentNode;
  }
  return section;
}

/**
 * Start targeting for a client on a host.
 * @param client The client.
 * @param host The host.
 */
export default function loadTargetOffers(client, host) {
  // eslint-disable-next-line no-console
  console.debug(`Loading offers for client ${client} on host ${host}`);

  createPerformanceMark('targeting:loading-offers');

  const sessionId = getOrCreateSessionId();
  // eslint-disable-next-line no-console
  console.debug(`Using session ID ${sessionId}`);

  document.body.style.visibility = 'hidden';

  const pendingOffers = fetchOffers(client, host, sessionId);

  getDecoratedContent()
    .then(async (main) => {
      const offers = await pendingOffers;
      measurePerformance('targeting:loading-offers');

      offers.forEach((offer) => {
        // eslint-disable-next-line no-console
        console.debug('processing offer', offer);
        const section = getSectionByElementSelector(offer.selector);
        if (section) {
          // eslint-disable-next-line no-console
          console.debug(`hiding section for selector ${offer.selector}`, section);
          section.style.visibility = 'hidden';
          createPerformanceMark(
            `targeting:rendering-section:${Array.from(section.classList)
              .join('_')}`,
          );
        }
      });

      document.body.style.visibility = 'visible';

      getLoadedSections(main)
        .forEach((pendingSection) => {
          pendingSection.then((section) => displayOffers(section, offers));
        });
    });
}
