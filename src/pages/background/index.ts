/**
 * Minimal background script to handle URL opening fallback
 * when CSP blocks window.open from the content script
 */
chrome.runtime.onMessage.addListener((request) => {
  if (request.url) {
    chrome.tabs.create({ url: request.url });
  }
}); 