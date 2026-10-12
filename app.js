// 青年高中校史影片 — 動畫引擎
// 以單一時間軸 t（秒）決定每一格畫面，因此可隨時暫停、拖曳、跳章節。
(async () => {
  const NS = 'http://www.w3.org/2000/svg';
  const DATA = window.HISTORY;
  const ICONS = window.ICONS;
  const EVENTS = DATA.events;

  const C = {
    orange: '#FF7F00', orangeSoft: '#FFF1E3', orangeLine: '#FFB066',
    gray: '#8E8E8E', grayLight: '#D8D2CA', ink: '#2B2B2B', text: '#555',
    paper: '#FBF6EE', card: '#FFFFFF', stamp: '#D9381E',
  };
  const ZH = "'Noto Sans TC','Noto Sans JP','Microsoft JhengHei','PingFang TC',sans-serif";
  const NUM = "'Barlow Condensed','Oswald','Arial Narrow',sans-serif";
  const CN_NUM = ['', '一', '二', '三', '四', '五', '六'];

  // ---------- 小工具 ----------
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const txt = (parent, x, y, s, attrs = {}) => {
    const n = el('text', { x, y, ...attrs }, parent);
    n.textContent = s;
    return n;
  };
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const prog = (t, start, dur) => clamp01((t - start) / dur);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeIn = k => k * k * k;
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeBack = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const set = (n, attrs) => { for (const k in attrs) n.setAttribute(k, attrs[k]); };
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const rocDate = ev => `民國${ev.y - 1911}年 ${ev.m}月${ev.d ? ev.d + '日' : ''}`;

  // 文字量測與中文斷行（避免標點出現在行首）
  const mctx = document.createElement('canvas').getContext('2d');
  const measure = (s, size, weight = 400, fam = ZH) => { mctx.font = `${weight} ${size}px ${fam}`; return mctx.measureText(s).width; };
  const NO_START = '，。、；：！？」』）%》,.';
  function wrap(s, maxW, size, weight = 400) {
    const tokens = s.match(/[A-Za-z0-9.,%]+|./gu) || [];
    const lines = [];
    let line = '';
    for (const tk of tokens) {
      const next = line + tk;
      if (line && measure(next, size, weight) > maxW && !NO_START.includes(tk)) {
        lines.push(line);
        line = tk;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---------- 等待字型載入（量測才準確） ----------
  const allText = [DATA.intro, DATA.motto.join(''), DATA.mottoBy,
    ...DATA.chapters.map(c => c.name + c.tagline),
    ...EVENTS.map(e => e.head + e.text + (e.depts || []).join('') + (e.rebuild || '') + (e.principal ? e.principal.name : '')),
    '歷年設立科班歷任校長第任代理創校至今年個章民國月日青年高中校史沿革新增天內復學復課震後重建西元繼往開來'].join('');
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`400 32px 'Noto Sans TC'`, allText),
        document.fonts.load(`700 32px 'Noto Sans TC'`, allText),
        document.fonts.load(`900 32px 'Noto Sans TC'`, allText),
        document.fonts.load(`700 32px 'Barlow Condensed'`, '0123456789—.'),
        document.fonts.load(`900 32px 'Noto Sans JP'`, '勲'),
        document.fonts.load(`700 32px 'Noto Sans JP'`, '勲'),
      ]),
      new Promise(r => setTimeout(r, 4000)),
    ]);
  } catch (e) { /* 離線時使用系統字型 */ }

  // ---------- 衍生資料 ----------
  const evPos = ev => ev.y + (ev.m - 1) / 12;
  // 類科之樹：每個新設科班一片葉子
  const LEAVES = [];
  EVENTS.forEach((ev, i) => (ev.depts || []).forEach(name => LEAVES.push({ name, ev: i })));
  const leavesUpTo = i => LEAVES.filter(l => l.ev <= i).length;
  // 校長接力
  function principalState(i) {
    const names = {}; let lastNo = 0, acting = null;
    for (let k = 0; k <= i && k < EVENTS.length; k++) {
      const p = EVENTS[k].principal;
      if (!p) continue;
      if (p.acting) acting = p.name;
      else { names[p.no] = p.name; lastNo = p.no; acting = null; }
    }
    return { names, lastNo, acting };
  }
  const MAX_PRINCIPAL = Math.max(...EVENTS.filter(e => e.principal && e.principal.no).map(e => e.principal.no));
  const YEARS = EVENTS[EVENTS.length - 1].y - EVENTS[0].y;

  // ---------- 時間軸（分段） ----------
  // 每段的長度 = max(畫面所需時間, 口白結束 + 收尾時間)；同段多句口白自動錯開不重疊
  const NARR = window.NARRATION || {};
  const segs = [];
  let T = 0;
  const push = (type, key, minDur, extra = {}) => {
    let end = 0;
    const voice = (NARR[key] || []).map(c => {
      const at = Math.max(c.at, end ? end + 0.3 : 0);
      end = at + c.dur;
      return { at, dur: c.dur, src: c.src };
    });
    const dur = Math.max(minDur, voice.length ? end + (type === 'chapter' ? 0.6 : 0.9) : 0);
    segs.push({ type, key, start: T, dur, voice, ...extra });
    T += dur;
  };
  const eventDur = ev => {
    if (ev.special === 'quake') return 11;
    const n = (ev.head + ev.text).length;
    return Math.min(6.5, Math.max(3.8, 2.6 + n * 0.032));
  };
  push('intro', 'intro', 8.5, { evIdx: -1 });
  let lastCh = 0;
  EVENTS.forEach((ev, i) => {
    if (ev.ch !== lastCh) {
      push('chapter', `ch${ev.ch}`, 3.4, { ch: DATA.chapters.find(c => c.id === ev.ch), evIdx: i - 1 });
      lastCh = ev.ch;
    }
    push('event', `ev${i}`, eventDur(ev), { ev, evIdx: i });
  });
  push('outro', 'outro', 14, { evIdx: EVENTS.length - 1 });
  const TOTAL = T;

  // ---------- SVG 骨架 ----------
  const svg = document.getElementById('svg');
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#7a4a10" flood-opacity="0.12"/>
    </filter>
    <radialGradient id="glow" cx="50%" cy="60%" r="60%">
      <stop offset="0" stop-color="#FF8A1F" stop-opacity=".55"/>
      <stop offset="1" stop-color="#FF8A1F" stop-opacity="0"/>
    </radialGradient>
    ${[['ch1', '#FF7F00', '#FFA040'], ['ch2', '#7B7B7B', '#A5A5A5'], ['ch3', '#262626', '#474747'],
       ['ch4', '#E8590C', '#FF8A1F'], ['ch5', '#FF8A1F', '#FFB347']]
      .map(([id, a, b]) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}
  `;
  const world = el('g', {}, svg);       // 震動用
  const hudLayer = el('g', {}, world);
  const stage = el('g', {}, world);

  // ---------- HUD：常駐畫面元素 ----------
  const hud = (() => {
    const g = hudLayer;
    el('rect', { width: 1920, height: 1080, fill: C.paper }, g);
    el('circle', { cx: 1880, cy: 1040, r: 420, fill: '#F6EDE1' }, g);
    el('circle', { cx: 40, cy: 80, r: 220, fill: '#F8F0E5' }, g);

    // 頁首
    const pill = el('rect', { x: 80, y: 44, height: 56, rx: 28, fill: C.orange }, g);
    const pillText = txt(g, 108, 82, '', { class: 'zh', 'font-size': 28, 'font-weight': 700, fill: '#fff' });
    const pillYears = txt(g, 0, 82, '', { class: 'num', 'font-size': 32, 'font-weight': 600, fill: C.gray });
    el('image', { href: 'assets/logo.jpg', x: 1762, y: 30, width: 86, height: 81, style: 'mix-blend-mode:multiply' }, g);
    txt(g, 1745, 84, '青年高中 · 校史沿革', { class: 'zh', 'font-size': 28, 'font-weight': 700, fill: '#666', 'text-anchor': 'end' });

    // 左欄：年份
    txt(g, 86, 180, '西元', { class: 'zh', 'font-size': 26, fill: C.gray, 'letter-spacing': 6 });
    const year = txt(g, 74, 400, '1971', { class: 'num', 'font-size': 260, 'font-weight': 700, fill: C.orange, 'letter-spacing': -4 });
    const date = txt(g, 86, 462, '', { class: 'zh', 'font-size': 40, 'font-weight': 700, fill: '#666' });
    el('line', { x1: 86, y1: 500, x2: 600, y2: 500, stroke: '#E6DCCF', 'stroke-width': 3 }, g);

    // 左欄：類科之樹
    const tree = el('g', {}, g);
    const TC = { x: 205, y: 650 };
    el('ellipse', { cx: TC.x, cy: 846, rx: 120, ry: 12, fill: '#EFE4D6' }, tree);
    el('circle', { cx: TC.x, cy: TC.y, r: 128, fill: '#F4EADD' }, tree);
    el('path', { d: `M${TC.x} 742 Q${TC.x - 46} 700 ${TC.x - 78} 628 M${TC.x} 716 Q${TC.x + 44} 676 ${TC.x + 70} 600 M${TC.x} 720 Q${TC.x - 4} 640 ${TC.x + 2} 560`, fill: 'none', stroke: '#8A8A8A', 'stroke-width': 12, 'stroke-linecap': 'round' }, tree);
    el('path', { d: `M${TC.x - 18} 846 Q${TC.x - 8} 780 ${TC.x - 8} 712 L${TC.x + 8} 712 Q${TC.x + 8} 780 ${TC.x + 18} 846 Z`, fill: '#8A8A8A' }, tree);
    const leafFill = ['#FF8A1F', '#FFA94D', '#FFC98A', '#E86A00'];
    const leaves = LEAVES.map((l, i) => {
      const a = i * 2.39996 + 0.6, r = 22 + 98 * Math.sqrt(i / Math.max(1, LEAVES.length - 1));
      const x = TC.x + r * Math.cos(a), y = TC.y + r * Math.sin(a) * 0.9;
      const lg = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, tree);
      const inner = el('g', {}, lg);
      el('path', { d: 'M-22 0 Q0 -15 22 0 Q0 15 -22 0 Z', fill: leafFill[i % 4], transform: `rotate(${((a * 180) / Math.PI + 90) % 180})` }, inner);
      return inner;
    });
    txt(g, 362, 600, '歷年設立科班', { class: 'zh', 'font-size': 26, 'font-weight': 700, fill: C.gray });
    const leafNum = el('text', { x: 360, y: 720, fill: C.orange }, g);
    const leafNumN = el('tspan', { class: 'num', 'font-size': 130, 'font-weight': 700 }, leafNum);
    const leafNumU = el('tspan', { class: 'zh', 'font-size': 32, 'font-weight': 700, dx: 8, fill: C.gray }, leafNum);
    leafNumU.textContent = '個';
    const leafCap = el('g', {}, g);

    // 內容卡片
    el('rect', { x: 660, y: 140, width: 1190, height: 705, rx: 32, fill: C.card, filter: 'url(#shadow)' }, g);

    // 校長接力
    txt(g, 80, 924, '歷任校長', { class: 'zh', 'font-size': 26, 'font-weight': 700, fill: C.gray });
    const slots = [];
    for (let k = 1; k <= MAX_PRINCIPAL; k++) {
      const x = 214 + (k - 1) * 181;
      const sg = el('g', { transform: `translate(${x + 85} 912)` }, g);
      const inner = el('g', {}, sg);
      const r = el('rect', { x: -85, y: -36, width: 170, height: 72, rx: 16, 'stroke-width': 3 }, inner);
      const t1 = txt(inner, 0, -6, `第${k}任`, { class: 'zh', 'font-size': 19, 'font-weight': 700, 'text-anchor': 'middle' });
      const t2 = txt(inner, 0, 24, '', { class: 'zh', 'font-size': 27, 'font-weight': 900, 'text-anchor': 'middle' });
      slots.push({ k, inner, r, t1, t2 });
    }

    // 年代時間軸
    const TL = { x0: 120, x1: 1800, y: 1012, y0: 1971, y1: 2027 };
    const tx = p => TL.x0 + ((p - TL.y0) / (TL.y1 - TL.y0)) * (TL.x1 - TL.x0);
    el('line', { x1: TL.x0, y1: TL.y, x2: TL.x1, y2: TL.y, stroke: '#E3D8CA', 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
    const tlFill = el('line', { x1: TL.x0, y1: TL.y, x2: TL.x0, y2: TL.y, stroke: C.orange, 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
    [1971, 1980, 1990, 2000, 2010, 2020, 2026].forEach(yr => {
      el('line', { x1: tx(yr), y1: TL.y + 12, x2: tx(yr), y2: TL.y + 22, stroke: '#C9BBA8', 'stroke-width': 3 }, g);
      txt(g, tx(yr), TL.y + 50, String(yr), { class: 'num', 'font-size': 26, 'font-weight': 600, fill: '#A89A88', 'text-anchor': 'middle' });
    });
    const dots = EVENTS.map(ev => {
      const dg = el('g', { transform: `translate(${tx(evPos(ev)).toFixed(1)} ${TL.y})` }, g);
      return el('circle', { r: 7, fill: '#fff', stroke: C.orange, 'stroke-width': 4 }, dg);
    });
    const marker = el('g', {}, g);
    el('circle', { r: 22, fill: C.orange, opacity: 0.2 }, marker);
    el('circle', { r: 12, fill: C.orange, stroke: '#fff', 'stroke-width': 4 }, marker);

    let lastPill = '', lastCap = -2;

    function update(seg, lt) {
      const i = seg.evIdx;
      const ev = EVENTS[i];
      const isEvent = seg.type === 'event';
      const prevEv = EVENTS[i - 1];

      // 章節膠囊
      const ch = seg.type === 'chapter' ? seg.ch : DATA.chapters.find(c => c.id === (ev ? ev.ch : 1));
      const key = ch.id;
      if (key !== lastPill) {
        pillText.textContent = `第${CN_NUM[ch.id]}章　${ch.name}`;
        const w = measure(pillText.textContent, 28, 700) + 56;
        pill.setAttribute('width', w);
        pillYears.setAttribute('x', 80 + w + 20);
        pillYears.textContent = `${ch.from} — ${ch.to}`;
        lastPill = key;
      }

      // 年份滾動
      let pos;
      if (!ev) pos = 1971 + 5 / 12;
      else if (isEvent) {
        const from = prevEv ? evPos(prevEv) : 1971;
        pos = lerp(from, evPos(ev), easeInOut(prog(lt, 0, 0.9)));
      } else pos = evPos(ev);
      year.textContent = String(Math.floor(pos + 1e-6));
      date.textContent = ev ? rocDate(ev) : '民國60年';
      date.setAttribute('opacity', isEvent ? prog(lt, 0.6, 0.4) : 1);

      // 時間軸
      const mx = tx(pos);
      tlFill.setAttribute('x2', mx);
      marker.setAttribute('transform', `translate(${mx} ${TL.y})`);
      dots.forEach((d, k) => {
        const on = k <= i;
        const s = on ? (isEvent && k === i ? easeBack(prog(lt, 0.8, 0.4)) : 1) : 0;
        d.setAttribute('transform', `scale(${s})`);
      });

      // 類科之樹
      const nNow = leavesUpTo(i), nPrev = leavesUpTo(i - 1);
      leaves.forEach((lf, k) => {
        let s = k < nNow ? 1 : 0;
        if (isEvent && k >= nPrev && k < nNow) s = easeBack(prog(lt, 0.9 + (k - nPrev) * 0.15, 0.45));
        lf.setAttribute('transform', `scale(${s})`);
      });
      const shown = isEvent && nNow > nPrev ? Math.round(lerp(nPrev, nNow, prog(lt, 0.9, 0.5))) : nNow;
      leafNumN.textContent = shown;
      let capIdx = -1;
      for (let k = Math.min(i, EVENTS.length - 1); k >= 0; k--) if (EVENTS[k].depts) { capIdx = k; break; }
      if (capIdx !== lastCap) {
        leafCap.replaceChildren();
        if (capIdx >= 0) {
          const ce = EVENTS[capIdx];
          txt(leafCap, 362, 762, `${ce.y} 新增`, { class: 'zh', 'font-size': 22, 'font-weight': 700, fill: C.orange });
          // 以科班名稱為單位換行，不從名稱中間斷開
          const capLines = [''];
          ce.depts.forEach(name => {
            const cur = capLines[capLines.length - 1];
            const next = cur ? cur + '、' + name : name;
            if (cur && measure(next, 24, 700) > 250) { capLines[capLines.length - 1] += '、'; capLines.push(name); }
            else capLines[capLines.length - 1] = next;
          });
          capLines.slice(0, 3).forEach((ln, k) =>
            txt(leafCap, 362, 796 + k * 30, ln, { class: 'zh', 'font-size': 24, 'font-weight': 700, fill: '#666' }));
        }
        lastCap = capIdx;
      }
      leafCap.setAttribute('opacity', isEvent && capIdx === i ? prog(lt, 1.0, 0.4) : 1);

      // 校長接力
      const ps = principalState(i);
      const pev = isEvent && ev.principal ? ev.principal : null;
      const popSlot = pev ? (pev.acting ? ps.lastNo + 1 : pev.no) : -1;
      slots.forEach(s => {
        const name = ps.names[s.k];
        let fill, stroke, dash = null, c1, c2, label = '';
        if (name) {
          label = name;
          const cur = s.k === ps.lastNo && !ps.acting;
          fill = cur ? C.orange : '#fff'; stroke = cur ? C.orange : '#CFC6BA';
          c1 = cur ? '#FFE3C6' : C.gray; c2 = cur ? '#fff' : C.ink;
        } else if (ps.acting && s.k === ps.lastNo + 1) {
          label = '代理 ' + ps.acting;
          fill = '#FFF6EC'; stroke = C.orange; dash = '8 6'; c1 = C.orange; c2 = '#B65A00';
        } else {
          fill = 'none'; stroke = C.grayLight; dash = '8 6'; c1 = '#C5BBAE'; c2 = '#C5BBAE';
        }
        set(s.r, { fill, stroke });
        if (dash) s.r.setAttribute('stroke-dasharray', dash); else s.r.removeAttribute('stroke-dasharray');
        s.t1.setAttribute('fill', c1);
        s.t2.setAttribute('fill', c2);
        s.t2.textContent = label;
        s.t2.setAttribute('font-size', label.length > 4 ? 23 : 27);
        const sc = s.k === popSlot ? lerp(0.6, 1, easeBack(prog(lt, 0.7, 0.5))) : 1;
        s.inner.setAttribute('transform', `scale(${sc})`);
      });
    }
    return { update };
  })();

  // ---------- 場景 ----------
  function iconGroup(parent, name, opts) {
    const g = el('g', {}, parent);
    const inner = el('g', { transform: 'translate(-150 -150)' }, g);
    inner.innerHTML = ICONS[name](opts);
    return g;
  }

  function fadeOut(lt, dur, len = 0.45) { return 1 - prog(lt, dur - len, len); }

  function eventScene(seg) {
    const ev = seg.ev;
    if (ev.special === 'quake') return quakeScene(seg);
    const root = el('g', { class: 'zh' });
    const CX = 1255;

    // 插圖
    const n = ev.icons.length;
    const size = n === 1 ? 330 : n === 2 ? 290 : 250;
    const gap = n === 3 ? 310 : 350;
    el('ellipse', { cx: CX, cy: 440, rx: n === 1 ? 220 : 470, ry: 22, fill: '#F4ECE2' }, root);
    const icons = ev.icons.map((name, k) => {
      const g = iconGroup(root, name, name === 'principal' ? ev.principal : undefined);
      return { g, x: CX + (k - (n - 1) / 2) * gap, y: 290, s: size / 300 };
    });

    // 標題：以 / 分隔則變成多個標籤
    const parts = ev.head.split('/').map(s => s.trim()).filter(Boolean);
    const heads = [];
    let y = 500;
    const MAXW = 1080;
    if (parts.length > 1) {
      const FS = 38, H = 64, PAD = 28, GAP = 16;
      const rows = [[]]; let rowW = 0;
      parts.forEach(p => {
        const w = measure(p, FS, 700) + PAD * 2;
        if (rowW && rowW + GAP + w > MAXW) { rows.push([]); rowW = 0; }
        rows[rows.length - 1].push({ p, w });
        rowW += (rowW ? GAP : 0) + w;
      });
      rows.forEach(row => {
        const total = row.reduce((a, c) => a + c.w, 0) + GAP * (row.length - 1);
        let x = CX - total / 2;
        row.forEach(({ p, w }) => {
          const g = el('g', {}, root);
          el('rect', { x, y, width: w, height: H, rx: H / 2, fill: C.orangeSoft, stroke: C.orangeLine, 'stroke-width': 3 }, g);
          el('circle', { cx: x + 22, cy: y + H / 2, r: 6, fill: C.orange }, g);
          txt(g, x + w / 2 + 8, y + 45, p, { 'font-size': FS, 'font-weight': 700, fill: C.ink, 'text-anchor': 'middle' });
          heads.push(g);
          x += w + GAP;
        });
        y += H + 14;
      });
      y += 18;
    } else {
      wrap(ev.head, MAXW, 60, 900).forEach(ln => {
        heads.push(txt(root, CX, y + 58, ln, { 'font-size': 60, 'font-weight': 900, fill: C.ink, 'text-anchor': 'middle' }));
        y += 76;
      });
      y += 20;
    }

    // 內文
    let fs = 32, lh = 50, lines = wrap(ev.text, MAXW, fs);
    if (lines.length > 4) { fs = 28; lh = 44; lines = wrap(ev.text, MAXW, fs); }
    const body = lines.map((ln, k) => txt(root, CX, y + fs + k * lh, ln, { 'font-size': fs, fill: C.text, 'text-anchor': 'middle' }));

    // 印章
    let stamp = null;
    if (ev.stamp) {
      stamp = el('g', {}, root);
      const sl = ev.stamp.split('|');
      el('circle', { r: 86, fill: 'rgba(255,255,255,.6)', stroke: C.stamp, 'stroke-width': 7 }, stamp);
      el('circle', { r: 72, fill: 'none', stroke: C.stamp, 'stroke-width': 2.5 }, stamp);
      sl.forEach((s, k) => txt(stamp, 0, (k - (sl.length - 1) / 2) * 40 + 13, s,
        { 'font-size': sl.length > 1 ? 32 : 38, 'font-weight': 900, fill: C.stamp, 'text-anchor': 'middle' }));
    }

    function update(lt, dur) {
      root.setAttribute('opacity', fadeOut(lt, dur));
      icons.forEach((ic, k) => {
        const p = prog(lt, 0.15 + k * 0.18, 0.55);
        const s = ic.s * lerp(0.4, 1, easeBack(p));
        const fy = Math.sin((lt + k * 0.9) * 1.6) * 3 * p;
        set(ic.g, { transform: `translate(${ic.x} ${ic.y + fy}) scale(${s})`, opacity: clamp01(p * 3) });
      });
      heads.forEach((h, k) => {
        const p = easeOut(prog(lt, 0.45 + k * 0.12, 0.5));
        set(h, { opacity: p, transform: `translate(0 ${(1 - p) * 30})` });
      });
      body.forEach((b, k) => {
        const p = easeOut(prog(lt, 0.85 + k * 0.1, 0.5));
        set(b, { opacity: p, transform: `translate(0 ${(1 - p) * 20})` });
      });
      if (stamp) {
        const p = prog(lt, 1.3, 0.3);
        set(stamp, { opacity: p * 0.92, transform: `translate(1700 250) rotate(-14) scale(${lerp(2.2, 1, easeIn(p))})` });
      }
    }
    return { root, update };
  }

  function quakeScene(seg) {
    const ev = seg.ev;
    const root = el('g', { class: 'zh' });
    el('rect', { width: 1920, height: 1080, fill: '#262626' }, root);
    const glow = el('ellipse', { cx: 960, cy: 760, rx: 1100, ry: 700, fill: 'url(#glow)' }, root);

    const cracks = [
      'M0 300 L180 340 L260 290 L420 380 L520 350 L700 460 L820 420 L960 520',
      'M1920 220 L1760 300 L1690 260 L1540 360 L1420 330 L1280 450 L1140 430 L960 520',
      'M960 520 L900 640 L980 700 L920 820 L990 900 L940 1080',
      'M960 520 L1080 600 L1200 580 L1300 700 L1460 720 L1600 860 L1920 900',
    ].map(d => el('path', { d, fill: 'none', stroke: '#EDEDED', 'stroke-width': 5, 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, root));

    const p1 = el('g', {}, root);
    const dateT = txt(p1, 960, 330, `${ev.y}.${ev.m}.${ev.d}`, { class: 'num', 'font-size': 190, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle' });
    const title = txt(p1, 960, 450, '921 大地震', { 'font-size': 88, 'font-weight': 900, fill: C.orange, 'text-anchor': 'middle' });
    const body = wrap(ev.text, 1300, 36).map((ln, k) =>
      txt(p1, 960, 570 + k * 56, ln, { 'font-size': 36, fill: '#E8E8E8', 'text-anchor': 'middle' }));

    const p2 = el('g', {}, root);
    const icon = iconGroup(p2, 'rebuild');
    const num = txt(p2, 900, 790, '0', { class: 'num', 'font-size': 280, 'font-weight': 700, fill: C.orange, 'text-anchor': 'end' });
    txt(p2, 930, 700, '天內', { 'font-size': 64, 'font-weight': 900, fill: '#fff' });
    txt(p2, 930, 785, '復學、復課', { 'font-size': 64, 'font-weight': 900, fill: '#fff' });
    const sub = el('g', {}, p2);
    txt(sub, 960, 880, '曾校長率領全校師生震後重建', { 'font-size': 34, 'font-weight': 700, fill: '#FFD2A3', 'text-anchor': 'middle' });
    txt(sub, 960, 932, ev.rebuild, { 'font-size': 30, fill: '#DADADA', 'text-anchor': 'middle' });

    function update(lt, dur) {
      root.setAttribute('opacity', prog(lt, 0, 0.35) * fadeOut(lt, dur, 0.5));
      cracks.forEach((c, k) => {
        const p = easeOut(prog(lt, 0.35 + k * 0.12, 0.7));
        // 裂痕畫完後淡化，避免干擾文字
        set(c, { 'stroke-dashoffset': 1 - p, opacity: lerp(1, 0.22, prog(lt, 1.4, 0.6)) * (1 - prog(lt, 5.2, 0.6)) });
      });
      const d = easeOut(prog(lt, 0.5, 0.6));
      set(dateT, { opacity: d, transform: `translate(0 ${(1 - d) * 30})` });
      set(title, { opacity: easeOut(prog(lt, 1.0, 0.5)) });
      body.forEach((b, k) => b.setAttribute('opacity', easeOut(prog(lt, 1.8 + k * 0.25, 0.5))));
      p1.setAttribute('opacity', 1 - prog(lt, 5.2, 0.6));

      const q = prog(lt, 5.6, 0.8);
      glow.setAttribute('opacity', easeOut(q));
      p2.setAttribute('opacity', easeOut(q));
      const ip = easeOut(prog(lt, 5.7, 0.9));
      set(icon, { transform: `translate(960 ${330 + (1 - ip) * 80}) scale(0.95)`, opacity: ip });
      num.textContent = Math.round(30 * easeOut(prog(lt, 6.3, 1.4)));
      sub.setAttribute('opacity', easeOut(prog(lt, 7.6, 0.6)));
    }
    // 開場震動：振幅隨時間衰減
    const shake = lt => {
      const p = prog(lt, 0.3, 2.2);
      if (p <= 0 || p >= 1) return [0, 0];
      const a = 24 * (1 - p);
      return [Math.sin(lt * 71) * a, Math.cos(lt * 53) * a * 0.7];
    };
    return { root, update, shake };
  }

  function chapterScene(seg) {
    const ch = seg.ch;
    const root = el('g', { class: 'zh' });
    const panel = el('g', {}, root);
    el('rect', { width: 1920, height: 1080, fill: `url(#ch${ch.id})` }, panel);
    el('circle', { cx: 1500, cy: 540, r: 360, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.12, 'stroke-width': 70 }, panel);
    el('path', { d: 'M1500 120 A420 420 0 0 1 1500 960', fill: 'none', stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 26 }, panel);
    txt(panel, 1500, 640, String(ch.id).padStart(2, '0'), { class: 'num', 'font-size': 340, 'font-weight': 700, fill: '#fff', 'fill-opacity': 0.22, 'text-anchor': 'middle' });
    const items = [
      txt(panel, 200, 390, `第${CN_NUM[ch.id]}章`, { 'font-size': 46, 'font-weight': 700, fill: '#fff', 'letter-spacing': 10, opacity: 0.9 }),
      txt(panel, 196, 560, ch.name, { 'font-size': 160, 'font-weight': 900, fill: '#fff' }),
      txt(panel, 200, 670, `${ch.from} — ${ch.to}`, { class: 'num', 'font-size': 80, 'font-weight': 600, fill: '#fff' }),
      txt(panel, 200, 760, ch.tagline, { 'font-size': 40, fill: '#fff', opacity: 0.92 }),
    ];
    function update(lt, dur) {
      let x = 0;
      if (lt < 0.65) x = -1920 * (1 - easeOut(lt / 0.65));
      else if (lt > dur - 0.6) x = 1920 * easeIn(prog(lt, dur - 0.6, 0.6));
      panel.setAttribute('transform', `translate(${x} 0)`);
      items.forEach((it, k) => {
        const p = easeOut(prog(lt, 0.4 + k * 0.12, 0.6));
        set(it, { 'fill-opacity': p, transform: `translate(${(1 - p) * 120} 0)` });
      });
    }
    return { root, update };
  }

  function introScene() {
    const root = el('g', { class: 'zh' });
    el('rect', { width: 1920, height: 1080, fill: C.paper }, root);
    el('circle', { cx: 1780, cy: 980, r: 380, fill: '#F6EDE1' }, root);
    el('circle', { cx: 120, cy: 120, r: 260, fill: '#F8F0E5' }, root);
    const arcL = el('path', { d: 'M960 70 A260 260 0 0 0 960 590', fill: 'none', stroke: '#B5B5B5', 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, root);
    const arcR = el('path', { d: 'M960 70 A260 260 0 0 1 960 590', fill: 'none', stroke: C.orange, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, root);
    const logo = el('image', { href: 'assets/logo.jpg', x: -170, y: -160, width: 340, height: 319, style: 'mix-blend-mode:multiply' }, root);
    const t1 = txt(root, 960, 730, '青年高中', { 'font-size': 120, 'font-weight': 900, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': 16 });
    const t2 = txt(root, 960, 810, '校史沿革　1971 — 2026', { 'font-size': 48, 'font-weight': 700, fill: C.orange, 'text-anchor': 'middle', 'letter-spacing': 6 });
    const intro = wrap(DATA.intro, 1400, 32).map((ln, k) => txt(root, 960, 900 + k * 50, ln, { 'font-size': 32, fill: C.text, 'text-anchor': 'middle' }));
    function update(lt, dur) {
      root.setAttribute('opacity', fadeOut(lt, dur, 0.7));
      const a = easeInOut(prog(lt, 0.1, 1.4));
      arcL.setAttribute('stroke-dashoffset', 1 - a);
      arcR.setAttribute('stroke-dashoffset', 1 - a);
      const l = easeBack(prog(lt, 0.5, 0.9));
      set(logo, { transform: `translate(960 330) scale(${lerp(0.5, 1, l)})`, opacity: prog(lt, 0.5, 0.4) });
      [t1, t2].forEach((t, k) => {
        const p = easeOut(prog(lt, 1.4 + k * 0.35, 0.7));
        set(t, { opacity: p, transform: `translate(0 ${(1 - p) * 30})` });
      });
      intro.forEach((t, k) => t.setAttribute('opacity', easeOut(prog(lt, 2.6 + k * 0.3, 0.7))));
    }
    return { root, update };
  }

  function outroScene() {
    const root = el('g', { class: 'zh' });
    const bg = el('rect', { width: 1920, height: 1080, fill: C.paper }, root);
    const deco = el('g', {}, root);
    el('circle', { cx: 1780, cy: 980, r: 380, fill: '#F6EDE1' }, deco);
    el('circle', { cx: 120, cy: 120, r: 260, fill: '#F8F0E5' }, deco);

    const stats = el('g', {}, root);
    const items = [
      { n: YEARS, u: '年', label: '創校至今' },
      { n: MAX_PRINCIPAL, u: '任', label: '歷任校長' },
      { n: LEAVES.length, u: '個', label: '歷年設立科班' },
    ].map((it, k) => {
      const g = el('g', { transform: `translate(${480 + k * 480} 0)` }, stats);
      const t = el('text', { x: 0, y: 520, 'text-anchor': 'middle', fill: C.orange }, g);
      const tn = el('tspan', { class: 'num', 'font-size': 240, 'font-weight': 700 }, t);
      const tu = el('tspan', { 'font-size': 56, 'font-weight': 900, dx: 10, fill: C.ink }, t);
      tu.textContent = it.u;
      txt(g, 0, 610, it.label, { 'font-size': 40, 'font-weight': 700, fill: C.gray, 'text-anchor': 'middle' });
      return { g, tn, n: it.n };
    });

    const quote = el('g', {}, root);
    txt(quote, 330, 470, '「', { 'font-size': 200, 'font-weight': 900, fill: C.orange, opacity: 0.35 });
    txt(quote, 1590, 720, '」', { 'font-size': 200, 'font-weight': 900, fill: C.orange, opacity: 0.35, 'text-anchor': 'end' });
    const ql = DATA.motto.map((s, k) => txt(quote, 960, 470 + k * 120, s, { 'font-size': 92, 'font-weight': 900, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': 8 }));
    txt(quote, 960, 780, `— ${DATA.mottoBy}`, { 'font-size': 34, fill: C.gray, 'text-anchor': 'middle' });

    const end = el('g', {}, root);
    const logo = el('image', { href: 'assets/logo.jpg', x: -150, y: -141, width: 300, height: 282, style: 'mix-blend-mode:multiply' }, end);
    const e1 = txt(end, 960, 700, '青年高中', { 'font-size': 110, 'font-weight': 900, fill: C.ink, 'text-anchor': 'middle', 'letter-spacing': 16 });
    const e2 = txt(end, 960, 790, '1971 — 2026　繼往開來', { 'font-size': 46, 'font-weight': 700, fill: C.orange, 'text-anchor': 'middle', 'letter-spacing': 6 });

    function update(lt) {
      bg.parentNode.setAttribute('opacity', prog(lt, 0, 0.8));
      const sOut = 1 - prog(lt, 4.4, 0.5);
      stats.setAttribute('opacity', sOut);
      items.forEach((it, k) => {
        const p = easeOut(prog(lt, 0.7 + k * 0.25, 1.6));
        it.tn.textContent = Math.round(it.n * p);
        set(it.g, { opacity: prog(lt, 0.7 + k * 0.25, 0.4), transform: `translate(${480 + k * 480} ${(1 - easeOut(prog(lt, 0.7 + k * 0.25, 0.6))) * 40})` });
      });
      quote.setAttribute('opacity', prog(lt, 5.0, 0.6) * (1 - prog(lt, 8.6, 0.5)));
      ql.forEach((q, k) => {
        const p = easeOut(prog(lt, 5.1 + k * 0.5, 0.7));
        set(q, { opacity: p, transform: `translate(0 ${(1 - p) * 30})` });
      });
      const lp = easeBack(prog(lt, 9.2, 0.9));
      set(logo, { transform: `translate(960 360) scale(${lerp(0.5, 1, lp)})`, opacity: prog(lt, 9.2, 0.4) });
      [e1, e2].forEach((t, k) => {
        const p = easeOut(prog(lt, 9.9 + k * 0.4, 0.7));
        set(t, { opacity: p, transform: `translate(0 ${(1 - p) * 30})` });
      });
    }
    return { root, update };
  }

  const builders = { intro: introScene, chapter: chapterScene, event: eventScene, outro: outroScene };

  // ---------- 渲染 ----------
  let curSeg = -1, scene = null;
  const segAt = t => {
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].start) return i;
    return 0;
  };
  function render(t) {
    const i = segAt(Math.min(t, TOTAL - 1e-3));
    const seg = segs[i];
    if (i !== curSeg) {
      stage.replaceChildren();
      scene = builders[seg.type](seg);
      stage.appendChild(scene.root);
      curSeg = i;
    }
    const lt = Math.min(t, TOTAL) - seg.start;
    hud.update(seg, lt);
    scene.update(lt, seg.dur);
    const [sx, sy] = scene.shake ? scene.shake(lt) : [0, 0];
    world.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
  }

  // ---------- 播放控制 ----------
  const $ = id => document.getElementById(id);
  const seek = $('seek'), playBtn = $('play'), timeEl = $('time'), big = $('bigplay');
  seek.max = TOTAL;
  let t = 0, playing = false, last = null, ended = false;

  const m = /t=([\d.]+)/.exec(location.hash);
  if (m) t = Math.min(TOTAL, parseFloat(m[1]));
  if (location.hash.includes('clean')) document.body.classList.add('clean');

  const chapterSegs = segs.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'chapter' || s.type === 'intro' || s.type === 'outro');
  const marks = $('marks'), chBox = $('chapters');
  chapterSegs.forEach(({ s }) => {
    const label = s.type === 'intro' ? '序' : s.type === 'outro' ? '終' : `第${CN_NUM[s.ch.id]}章`;
    const b = document.createElement('button');
    b.textContent = label;
    b.title = s.type === 'chapter' ? `${s.ch.name} ${s.ch.from}–${s.ch.to}` : label;
    b.onclick = () => jump(s.start);
    b.dataset.start = s.start;
    chBox.appendChild(b);
    if (s.type === 'chapter') {
      const i = document.createElement('i');
      i.style.left = `${(s.start / TOTAL) * 100}%`;
      marks.appendChild(i);
    }
  });

  function setPlaying(p) {
    playing = p;
    last = null;
    playBtn.textContent = p ? '❚❚ 暫停' : '▶ 播放';
    big.classList.toggle('hidden', p);
    if (p) ended = false;
    poke();
  }
  function toggle() {
    if (!playing && t >= TOTAL - 0.01) t = 0;
    setPlaying(!playing);
  }
  function jump(to) { t = Math.max(0, Math.min(TOTAL, to)); ended = false; render(t); updateUI(); }
  function step(dir) {
    const i = segAt(t);
    const cur = segs[i];
    if (dir < 0 && t - cur.start > 1.2) return jump(cur.start);
    jump(segs[Math.max(0, Math.min(segs.length - 1, i + dir))].start);
  }
  function updateUI() {
    seek.value = t;
    timeEl.textContent = `${fmtTime(t)} / ${fmtTime(TOTAL)}`;
    const i = segAt(t);
    [...chBox.children].forEach((b, k) => {
      const s = chapterSegs[k].s, nx = chapterSegs[k + 1];
      b.classList.toggle('on', t >= s.start && (!nx || t < nx.s.start));
    });
    void i;
  }

  // ---------- 聲音：口白 + 背景音樂（皆跟隨時間軸 t 同步） ----------
  const audioOn = { voice: true, music: true };
  // 背景音樂最先載入、邊下載邊播放；口白只預先載入目前與接下來幾段，避免搶頻寬
  const bgm = new Audio('assets/bgm.m4a');
  bgm.loop = true;
  bgm.preload = 'auto';
  let bgmOK = true;
  bgm.onerror = () => { bgmOK = false; };
  const clipAudio = new Map();
  segs.forEach(s => s.voice.forEach(c => {
    const a = new Audio();
    a.preload = 'none';
    clipAudio.set(c, a);
  }));
  function prefetch(i) {
    for (let k = i; k < Math.min(segs.length, i + 3); k++) {
      segs[k].voice.forEach(c => {
        const a = clipAudio.get(c);
        if (!a.src) { a.preload = 'auto'; a.src = c.src; }
      });
    }
  }
  prefetch(0);
  let prefetchedAt = 0;
  const BGM_VOL = 0.55, BGM_DUCK = 0.3; // 有口白時音樂自動降低音量
  let bgmVol = 0, curClip = null;
  const safePlay = a => { const p = a.play(); if (p) p.catch(() => {}); };

  function syncAudio(dt) {
    const si = segAt(Math.min(t, TOTAL - 1e-3));
    const seg = segs[si];
    const lt = t - seg.start;
    if (si !== prefetchedAt) { prefetch(si); prefetchedAt = si; }
    const want = playing && audioOn.voice ? seg.voice.find(c => lt >= c.at && lt < c.at + c.dur) : null;
    const wantA = want ? clipAudio.get(want) : null;
    if (curClip && curClip !== wantA) { curClip.pause(); curClip = null; }
    if (wantA) {
      const pos = lt - want.at;
      if (curClip !== wantA) { wantA.currentTime = pos; safePlay(wantA); curClip = wantA; }
      else if (Math.abs(wantA.currentTime - pos) > 0.35) wantA.currentTime = pos;
    }

    if (!bgmOK) return;
    if (!playing || !audioOn.music) { if (!bgm.paused) bgm.pause(); bgmVol = 0; return; }
    const target = (curClip ? BGM_DUCK : BGM_VOL) * prog(t, 0, 1.5) * (1 - prog(t, TOTAL - 3, 3));
    bgmVol += (target - bgmVol) * Math.min(1, dt * 3);
    bgm.volume = clamp01(bgmVol);
    const D = bgm.duration;
    if (D) {
      const pos = t % D;
      let d = Math.abs(bgm.currentTime - pos);
      d = Math.min(d, D - d);
      if (bgm.paused || d > 0.6) bgm.currentTime = pos;
    }
    if (bgm.paused) safePlay(bgm);
  }

  const voiceBtn = $('voiceBtn'), musicBtn = $('musicBtn');
  const refreshAudioBtns = () => {
    voiceBtn.classList.toggle('on', audioOn.voice);
    musicBtn.classList.toggle('on', audioOn.music);
    voiceBtn.textContent = audioOn.voice ? '🗣 口白：開' : '🗣 口白：關';
    musicBtn.textContent = audioOn.music ? '🎵 音樂：開' : '🎵 音樂：關';
  };
  voiceBtn.onclick = () => { audioOn.voice = !audioOn.voice; refreshAudioBtns(); };
  musicBtn.onclick = () => { audioOn.music = !audioOn.music; refreshAudioBtns(); };
  refreshAudioBtns();

  big.onclick = toggle;
  playBtn.onclick = toggle;
  seek.oninput = () => jump(parseFloat(seek.value));
  $('fs').onclick = fullscreen;
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
  // 按鈕點完即失焦，避免空白鍵同時觸發按鈕點擊而重複切換
  document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') e.target.blur();
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'f' || e.key === 'F') fullscreen();
    else if (e.key === 'Home') jump(0);
    poke();
  });

  // 播放時閒置自動隱藏控制列
  let idleTimer = null;
  function poke() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (playing) idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
  }
  document.addEventListener('mousemove', poke);

  let lastFrame = null;
  function tick(now) {
    const dt = lastFrame == null ? 0 : (now - lastFrame) / 1000;
    lastFrame = now;
    if (playing) {
      if (last != null) t += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (t >= TOTAL) {
        t = TOTAL; ended = true;
        setPlaying(false);
        $('bigplay-label').textContent = '重新播放';
      }
    }
    render(t);
    updateUI();
    syncAudio(dt);
    requestAnimationFrame(tick);
  }
  $('bigplay-label').textContent = '播放校史影片';
  render(t);
  updateUI();
  requestAnimationFrame(tick);

  // 除錯用
  window.__video = { segs, TOTAL, jump, render, get t() { return t; }, get clip() { return curClip && curClip.src; }, bgm };
  console.log(`[校史影片] 總長 ${fmtTime(TOTAL)}（${TOTAL.toFixed(1)} 秒），${EVENTS.length} 則事件，${LEAVES.length} 個新設科班`);
})();
