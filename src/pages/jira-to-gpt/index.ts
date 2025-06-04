/**
 * Jira → ChatGPT content script
 * Injects a button beside the issue title and ships the ticket to ChatGPT.
 */
const presetPrompt =
  `You are a senior QA engineer. Review the following Jira ticket and propose a concise test plan:`;

// Check if current URL matches configured Jira URL
async function checkJiraUrl(): Promise<boolean> {
  const saved = await chrome.storage.sync.get(['jiraUrl']);
  if (!saved.jiraUrl) return false;
  
  const configuredUrl = new URL(saved.jiraUrl);
  const currentUrl = new URL(window.location.href);
  
  return currentUrl.hostname === configuredUrl.hostname;
}

// Initialize only if on configured Jira instance
checkJiraUrl().then(isValid => {
  if (isValid) {
    // 1. Observe Jira SPA DOM changes and insert button when the issue title appears
    const observer = new MutationObserver(insertButtonIfMissing);
    observer.observe(document.body, { childList: true, subtree: true });
    insertButtonIfMissing(); // try once on load
  }
});

function insertButtonIfMissing() {
  const titleBar = document.querySelector<HTMLElement>(
    '[data-test-id="issue.views.issue-base.foundation.summary.heading-wrong"]'
  );
  if (!titleBar) return;

  const container = titleBar.parentElement;
  if (!container || container.querySelector('#gptBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'gptBtn';
  btn.textContent = 'Send to ChatGPT';
  btn.style.cssText =
    'margin-left:8px;padding:4px 8px;cursor:pointer;font-size:12px;';
  btn.addEventListener('click', handleClick);
  container.appendChild(btn);
}

// 2. Handle button click
async function handleClick() {
  const data = await collectIssueData();
  const formatted = formatForChatGPT(data);
  const url = buildChatGPTUrl(formatted);

  try {
    // Preferred: open directly
    window.open(url, '_blank');
  } catch {
    // Fallback if CSP blocks window.open
    chrome.runtime.sendMessage({ link });
  }
}

// 3. Quick page-scrape to get summary, description and comments
async function collectIssueData() {
  const summary = text(
    '[data-test-id="issue.views.issue-base.foundation.summary.heading"]'
  );
  const desc = text('[data-test-id="issue.views.field.rich-text.description"]');
  const comments = [...document.querySelectorAll<HTMLElement>('[data-test-id="issue.views.comment.comment-body"]')]
    .map((el) => el.innerText.trim())
    .join('\n---\n');

  return { summary, desc, comments };

  function text(sel: string) {
    const el = document.querySelector<HTMLElement>(sel);
    return el ? el.innerText.trim() : '';
  }
}

// 4. Compose ChatGPT prompt
function formatForChatGPT({
  summary,
  desc,
  comments,
}: {
  summary: string;
  desc: string;
  comments: string;
}) {
  return `${presetPrompt}

Issue: ${summary}

Description:
${desc}

Comments:
${comments}`;
}

// 5. Build ChatGPT URL (temporary chat)
function buildChatGPTUrl(prompt: string) {
  // Limit to ~3500 chars to stay under 4 KiB once encoded
  const trimmed = prompt.slice(0, 3500);
  const qs = new URLSearchParams({
    'temporary-chat': 'true',
    model: '4o',
    q: trimmed,
  });
  return `https://chatgpt.com/?${qs.toString()}`;
}