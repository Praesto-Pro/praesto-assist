(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const transcript = $('#demo-transcript');
  const controls = $('#demo-controls');
  const activity = $('#demo-activity');
  const input = $('#demo-input');
  const send = $('#demo-compose button');
  const scenarios = {
    email: {
      question: 'Outlook is frozen and I have a quote to send. Can you help?',
      followup: 'Let’s narrow this down. Is only Outlook stuck, or is the whole computer unresponsive?',
      answers: ['Only Outlook', 'The whole computer'],
      checks: ['Computer responds to the support check', 'Internet connection is available', 'Outlook has stopped responding'],
      broad: ['Multiple apps respond slowly', 'CPU usage is elevated', 'Outlook is one of the affected apps'],
      diagnosis: 'The connection looks healthy, but Outlook isn’t responding. Restarting just Outlook is a reasonable first step; a full computer restart isn’t needed yet.',
      proposal: 'Restart Outlook',
      impact: 'Closes and reopens Outlook. Save any work you can first; unsaved drafts may be lost. No files will be deleted.',
      repair: ['Employee approved restarting Outlook', 'Outlook closed and reopened', 'App responsiveness check passed'],
      verify: 'Outlook responds again in this example. Can you open your email and send that quote?',
      tip: 'If a draft wasn’t saved, check Drafts before writing it again.'
    },
    wifi: {
      question: 'I’m connected to Wi-Fi, but websites won’t load.',
      followup: 'Is this happening only on your computer, or are other people having the same problem?',
      answers: ['Only my computer', 'Others are affected too'],
      checks: ['Wi-Fi adapter is enabled', 'Connected to the office network', 'Test webpage cannot be reached'],
      broad: ['Local Wi-Fi adapter is enabled', 'Connection to the gateway times out', 'Other employees report the same symptom'],
      diagnosis: 'Your Wi-Fi adapter is connected, but traffic isn’t getting through. I can try reconnecting this computer before we investigate the wider network.',
      proposal: 'Reconnect this computer to Wi-Fi',
      impact: 'Briefly disconnects and reconnects Wi-Fi. Finish calls or uploads first. Saved networks and files stay in place.',
      repair: ['Employee approved reconnecting Wi-Fi', 'Wi-Fi reconnected to the saved network', 'Test webpage is reachable'],
      verify: 'The connection check passed in this example. Can you load a website now?',
      tip: 'If it happens again, mention whether other computers are affected.'
    },
    slow: {
      question: 'My computer has suddenly become slow. Everything takes ages.',
      followup: 'Did this start while you were using one app, or has it been slow since you signed in?',
      answers: ['While using an app', 'Since I signed in'],
      checks: ['CPU usage is 96% in this example', 'An unresponsive background app is using most of the CPU', 'Available memory is sufficient'],
      broad: ['CPU usage is high after sign-in', 'Several startup apps are active', 'No single stalled app explains the slowdown'],
      diagnosis: 'One stalled app is using most of the processor. Closing that app may restore responsiveness without restarting your computer.',
      proposal: 'Close the unresponsive app',
      impact: 'Closes the affected app only. Save your work in it first; unsaved changes may be lost. Other apps stay open.',
      repair: ['Employee approved closing the stalled app', 'Unresponsive app closed', 'CPU usage dropped to 18% in this example'],
      verify: 'The processor load is back to normal in this example. Try switching between your apps—does it feel better?',
      tip: 'Reopen the app when you’re ready. If it stalls again, the support record can help with the next investigation.'
    },
    printer: {
      question: 'The office printer says offline, but it’s switched on.',
      followup: 'Can other people print, or is everyone seeing the same problem?',
      answers: ['Other people can print', 'Nobody can print'],
      checks: ['Printer is reachable on the network', 'This computer’s queue is marked offline', 'No active print jobs in this example'],
      broad: ['Printer cannot be reached from this computer', 'Local print service is running', 'Other employees cannot print either'],
      diagnosis: 'The printer is reachable, but this computer’s queue is set to offline. I can switch the queue back online and check its status.',
      proposal: 'Switch this printer queue online',
      impact: 'Changes the offline setting for this computer’s printer queue. No queued jobs or documents will be deleted.',
      repair: ['Employee approved switching the queue online', 'Offline setting cleared on this computer', 'Printer queue reports ready'],
      verify: 'The queue reports ready in this example. Try printing a document—did it come through?',
      tip: 'Choose the same printer when you try again. Praesto will keep the checks with this request.'
    }
  };
  let selected = null;
  let generation = 0;
  let busy = false;
  let attempted = false;
  let broad = false;
  let answer = '';
  let issue = '';
  let step = 'ready';
  let log = [];
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function message(text, user = false) {
    const row = element('div', null, user ? 'demo-message demo-message-user' : 'demo-message demo-message-agent');
    row.append(element('span', user ? 'YOU' : 'PRAESTO', 'demo-speaker'), element('p', text));
    transcript.append(row);
    transcript.scrollTop = transcript.scrollHeight;
    return row;
  }
  function record(text) {
    log.push(text);
    const row = element('li');
    row.append(element('span', String(log.length).padStart(2, '0'), 'demo-log-number'), element('span', text));
    activity.append(row);
    activity.scrollTop = activity.scrollHeight;
  }
  function status(text, index) {
    $('#demo-stage').textContent = text;
    Array.from($('#demo-progress').children).forEach((item, i) => {
      item.classList.toggle('complete', i < index);
      item.classList.toggle('current', i === index);
      if (i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
  }
  function setBusy(value) {
    busy = value;
    input.disabled = value;
    send.disabled = value;
    transcript.setAttribute('aria-busy', String(value));
  }
  function actions(options) {
    controls.replaceChildren();
    options.forEach(([label, callback]) => {
      const button = element('button', label);
      button.type = 'button';
      button.addEventListener('click', callback);
      controls.append(button);
    });
  }
  function focusControls() {
    const target = controls.querySelector('button') || input;
    transcript.scrollTop = transcript.scrollHeight;
    target.focus({preventScroll:true});
  }
  // Timers only pace fictional steps. A new conversation cancels the old run.
  async function runSteps(items, title, index) {
    const token = generation;
    controls.replaceChildren();
    setBusy(true);
    status(title, index);
    const panel = element('div', null, 'demo-checklist');
    panel.append(element('strong', title));
    transcript.append(panel);
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const item of items) {
      const row = element('p', 'Checking…', 'demo-check-running');
      panel.append(row);
      transcript.scrollTop = transcript.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, instant ? 0 : 650));
      if (token !== generation) return false;
      row.textContent = item;
      row.className = 'demo-check-done';
      record(item);
    }
    setBusy(false);
    return true;
  }
  function clear() {
    generation++;
    selected = null; attempted = false; broad = false; answer = ''; issue = ''; step = 'ready'; log = [];
    transcript.replaceChildren(); controls.replaceChildren(); activity.replaceChildren();
    input.value = ''; setBusy(false);
    document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed','false'));
    status('Ready when you are', 0);
  }
  function welcome() {
    clear();
    message('Hi, I’m Praesto. Tell me what’s getting in your way and we’ll work through it together. Choose an example or type a computer problem below.');
    record('Waiting for an example support request');
  }
  function start(key, text) {
    clear(); selected = key; step = 'question'; issue = text || scenarios[key].question;
    document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.scenario === key)));
    message(issue, true);
    record('Support request opened for WORKSTATION-07');
    message(scenarios[key].followup);
    status('A quick question first', 0);
    actions(scenarios[key].answers.map((label,i)=>[label,()=>investigate(label,i === 1)]));
    input.placeholder = 'Answer Praesto, or use a reply above…';
    focusControls();
  }
  async function investigate(text, wider) {
    if (busy) return;
    answer = text; broad = wider; step = 'investigating';
    message(text, true);
    message('Thanks—that helps. I’ll check the relevant device information first. These example checks won’t change anything.');
    const scenario = scenarios[selected];
    if (!await runSteps(broad ? scenario.broad : scenario.checks, 'Investigating the issue', 1)) return;
    if (broad) {
      step = 'review';
      const explanation = selected === 'wifi' || selected === 'printer'
        ? 'This appears to affect more than this computer. Repeated local resets are unlikely to solve a shared network or printer problem. I’ll preserve the findings for a technician rather than make a wider change.'
        : 'The symptoms go beyond one stalled app. I don’t have enough evidence for a targeted fix yet. A technician can review the findings before a broader change is considered.';
      message(explanation);
      status('Technician review recommended', 3);
      actions([['Prepare technician handoff',()=>handoff()],['Try another example',()=>reset()]]);
    } else proposal();
    focusControls();
  }
  function proposal() {
    step = 'approval';
    const scenario = scenarios[selected];
    message(scenario.diagnosis);
    const panel = element('div', null, 'demo-permission');
    panel.append(element('span','YOUR APPROVAL REQUIRED','demo-context-label'),element('strong',scenario.proposal),element('p',scenario.impact));
    transcript.append(panel);
    status('Waiting for your approval',2);
    record('Proposed change is waiting for employee approval');
    actions([['Approve this demo fix',()=>repair()],['Not now',()=>decline()]]);
  }
  async function repair() {
    if (busy) return;
    attempted = true; step = 'repairing';
    message('Go ahead. I’m ready.',true);
    if (!await runSteps(scenarios[selected].repair,'Applying the approved demo fix',2)) return;
    step = 'verify';
    message(scenarios[selected].verify);
    status('Checking the outcome with you',3);
    actions([['Yes, it’s working',()=>resolved()],['Still having trouble',()=>unresolved()]]);
    focusControls();
  }
  function decline() {
    step = 'paused';
    message('Not right now.',true);
    message('Of course. No changes have been made. When you’re ready, we can revisit this step—or I can prepare the findings for a technician.');
    record('Employee declined the change; no fix attempted');
    status('Paused at your request',2);
    actions([['Review the proposed fix',()=>{proposal();focusControls();}],['Prepare technician handoff',()=>handoff()]]);
    focusControls();
  }
  function resolved() {
    step = 'done';
    message('Yes, it’s working now. Thank you!',true);
    message('Glad you’re back up and running. '+scenarios[selected].tip);
    record('Employee confirmed resolution');
    status('Resolved · Confirmed by you',4);
    const panel = element('div',null,'demo-resolution');
    panel.append(element('strong','Resolved without a technician repair'),element('p','This example support record includes your description, diagnostic findings, approval, and verification.'));
    transcript.append(panel);
    actions([['Try another support request',()=>reset()]]);
    focusControls();
  }
  function unresolved() {
    step = 'review';
    message('I’m still having the same problem.',true);
    record('Employee reports the problem persists after the attempted fix');
    message('Thanks for checking. I won’t repeat the same fix. I can package what we’ve tried for a technician, including your description and the verification result.');
    status('Further help needed',3);
    actions([['Prepare technician handoff',()=>handoff()]]);
    focusControls();
  }
  function handoff() {
    step = 'done';
    record('Example handoff prepared; no real ticket submitted');
    status('Handoff ready · Awaiting review',4);
    message('Here’s the handoff. A technician gets the context and checks already performed, so you can pick up where we left off. Paid human troubleshooting would need separate approval of scope and cost.');
    const card = element('article',null,'demo-ticket');
    card.append(element('span','SIMULATED TICKET · PA-DEMO-1042','demo-context-label'),element('h4','Technician handoff'));
    const list = element('dl',null,'demo-findings');
    const rows = [['Computer','WORKSTATION-07 · Windows 11'],['Issue',issue],['Your answer',answer],['Assessment',broad ? 'Broader symptoms need technician review.' : attempted ? 'Local fix attempted; employee reports the issue persists.' : 'Proposed fix declined; no change made.'],['Next step','Review these findings and determine whether additional troubleshooting is needed.']];
    rows.forEach(([label,value])=>list.append(element('dt',label),element('dd',value)));
    card.append(list);
    const details = element('details');
    details.append(element('summary','View diagnostic and action record'));
    const history = element('ol');
    log.forEach(item=>history.append(element('li',item)));
    details.append(history); card.append(details);
    card.append(element('p','Technician safety review is included. Paid human repair only begins after separate scope and cost approval.','demo-scope'));
    transcript.append(card);
    actions([['Try another support request',()=>reset()]]);
    focusControls();
  }
  function reset() { welcome(); input.placeholder='Describe a problem, or choose an example above…'; input.focus({preventScroll:true}); }
  document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>start(button.dataset.scenario)));
  $('#demo-reset').addEventListener('click',reset);
  $('#demo-compose').addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    if (step === 'question') {
      const wider = /whole|everyone|others|nobody|since|all apps|all computers/i.test(text);
      investigate(text,wider); return;
    }
    if (step === 'verify' && /^(yes|works|working|fixed|great|resolved|thank)/i.test(text)) { resolved(); return; }
    if (step === 'verify' && /still|no|not|same|trouble/i.test(text)) { unresolved(); return; }
    if (['approval','paused','review'].includes(step)) {
      message(text,true);
      message('Use the choices below to continue this example. Proposed changes always require the explicit approval button. You can start a new issue with the examples above.');
      return;
    }
    const key = /outlook|email|mail|draft/i.test(text) ? 'email' : /wifi|wi-fi|internet|network|connect|websites/i.test(text) ? 'wifi' : /slow|performance|cpu|lag/i.test(text) ? 'slow' : /print/i.test(text) ? 'printer' : null;
    if (key) { start(key,text); return; }
    message(text,true);
    message('This preview has four scripted examples. Choose Outlook, Wi-Fi, a slow computer, or a printer above. A live Praesto session would investigate your actual enrolled device.');
  });
  input.addEventListener('keydown', event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('#demo-compose').requestSubmit();}});
  welcome();
})();
