// Create a performance mark
window.createPerfMark = (name) => {
  performance.mark(`perf-start-${name}`);
  console.log(`perf-${name} started at ${performance.now()} + ms`);
}

// Measure the time between two performance marks
window.measurePerfMark = (name) => {
  performance.mark(`perf-stop-${name}`);
  const duration = performance.measure(`perf-${name}`, `perf-start-${name}`, `perf-stop-${name}`);
  console.log(`perf-${name} stopped at ${performance.now()} ms`);
  console.log(`perf-${name} took ${duration.duration} ms`);
}

function uuid() {
  var d = new Date().getTime();//Timestamp
  var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16;//random number between 0 and 16
    if(d > 0){//Use timestamp until depleted
      r = (d + r)%16 | 0;
      d = Math.floor(d/16);
    } else {//Use microseconds since page-load if supported
      r = (d2 + r)%16 | 0;
      d2 = Math.floor(d2/16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function fetchDecisions(client, host) {
  const url = `https://${client}.tt.omtrdc.net/rest/v1/delivery?client=${client}&sessionId=${uuid()}`;
  const payload = {
    "context": {
      "channel": "web",
      "browser": {
        "host": host
      },
      "address": {
        "url": host
      }
    },
    "execute": {
      "pageLoad": {}
    }
  }
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cache-control': 'no-cache'
    },
    body: JSON.stringify(payload)
  };
  return fetch(url, options)
    .then(response => response.json())
    .then(data => {
      return data?.execute?.pageLoad?.options?.reduce(
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
        []
      );
    });
}

function getDecoratedMain() {
  return new Promise((resolve) => {
    if (document.body.classList.contains('appear')) {
      console.log('main already decorated');
      resolve(document.body.querySelector('main'));
    }
    const config = {attributes: true, attributeFilter: ['class']};
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

function getLoadedSections(main) {
  const sections = main.querySelectorAll('.section');
  return Array.from(sections).map((section) => {
    console.log('checking section', section);
    return new Promise((resolve) => {
      if (section.getAttribute('data-section-status') === 'loaded') {
        console.log('section already loaded', section);
        return resolve(section);
      }
      const config = {attributes: true, attributeFilter: ['data-section-status']};
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

function renderDecisions(section, decisions) {
  decisions.forEach((decision) => {
    const {type, selector, content} = decision;
    if (type === 'setHtml') {
      const targetElement = section.querySelector(selector);
      if (targetElement) {
        targetElement.innerHTML = content;
        console.log('section rendered', section);
      }
    }
    measurePerfMark('targeting');
  });
}

export function startTargeting(client, host) {
  console.log(`start targeting for ${client} on ${host}`);
  createPerfMark('targeting');
  const decisionsPromise = fetchDecisions(client, host);
  getDecoratedMain().then((main) => {
    getLoadedSections(main).map(async (sectionPromise) => {
      const decisions = await decisionsPromise;
      console.log('decisions', decisions);
      const section = await sectionPromise;
      console.log('section ready to render', section);
      renderDecisions(section, decisions);
      if (section.style.display === 'none') {
        section.style.display = null;
      }
    });
  });
}
