// 插畫圖示：細線條、低彩度的成熟風格（深灰線條 + 校色橘點綴）
// 每個圖示畫在 300×300 的方框內，回傳 SVG 字串
(() => {
  const K = '#2F3439';   // 線條
  const A = '#E8731A';   // 校色橘（強調）
  const AL = '#F7D9BE';  // 淺橘
  const N = '#59606A';   // 深石板灰（剪影、實心面）
  const NL = '#D5D8DC';  // 淺灰
  const P = '#FFFFFF';
  const BG = '#F4F0EA';  // 底圓
  const BLUE = '#A9C1CF', GREEN = '#B4C4A3', GOLD = '#E2B65E';

  const wrap = inner =>
    `<g stroke="${K}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none">` +
    `<circle cx="150" cy="150" r="134" fill="${BG}" stroke="none"/>` +
    `<circle cx="150" cy="150" r="134" stroke="#E6DFD5" stroke-width="2"/>` +
    inner + '</g>';

  const gear = (cx, cy, ro, ri, teeth) => {
    let d = '';
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      [[ri, a], [ro, a + step * 0.18], [ro, a + step * 0.5], [ri, a + step * 0.68]].forEach(([r, t], j) => {
        d += (i === 0 && j === 0 ? 'M' : 'L') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1);
      });
    }
    return d + 'Z';
  };
  const star = (cx, cy, r1, r2, n = 5) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / n;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };
  const windows = (xs, ys, w, h, fill = NL) =>
    ys.map(y => xs.map(x => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke-width="3"/>`).join('')).join('');
  const ground = (x1 = 44, x2 = 256, y = 260) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`;

  // 月桂枝（校長肖像框用）
  const laurel = () => {
    let s = '';
    const R = 112, cx = 150, cy = 138;
    for (let i = 0; i < 7; i++) {
      [100 + i * 19, 80 - i * 19].forEach((deg, side) => {
        const a = (deg * Math.PI) / 180;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const rot = deg + (side ? -60 : 60);
        s += `<ellipse cx="0" cy="0" rx="13" ry="5.5" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})" fill="${i % 2 ? AL : A}" stroke="none"/>`;
      });
    }
    return s;
  };

  const I = {
    principal(p = {}) {
      const body = p.female
        ? `<path d="M110 162 Q100 84 150 82 Q200 84 190 162 Q170 170 150 166 Q130 170 110 162 Z" fill="${K}" stroke="none"/>` +
          `<circle cx="150" cy="120" r="28" fill="${N}" stroke="none"/>` +
          `<path d="M84 240 Q88 172 150 170 Q212 172 216 240 Z" fill="${N}" stroke="none"/>` +
          `<path d="M134 172 L150 198 L166 172 Z" fill="${P}" stroke="none"/>` +
          `<path d="M128 176 Q150 200 172 176" stroke="${A}" stroke-width="4"/>`
        : `<circle cx="150" cy="118" r="30" fill="${N}" stroke="none"/>` +
          `<path d="M84 240 Q88 172 150 168 Q212 172 216 240 Z" fill="${N}" stroke="none"/>` +
          `<path d="M135 170 L150 200 L165 170 Z" fill="${P}" stroke="none"/>` +
          `<path d="M150 178 L144 188 L150 216 L156 188 Z" fill="${A}" stroke="none"/>`;
      const label = p.acting ? '代理' : p.no ? `第 ${p.no} 任` : '';
      return wrap(
        laurel() +
        `<defs><clipPath id="pclip"><circle cx="150" cy="138" r="86"/></clipPath></defs>` +
        `<circle cx="150" cy="138" r="86" fill="${P}"/>` +
        `<g clip-path="url(#pclip)">${body}</g>` +
        `<circle cx="150" cy="138" r="86"/><circle cx="150" cy="138" r="94" stroke-width="2"/>` +
        (label ? `<rect x="96" y="226" width="108" height="40" rx="4" fill="${p.acting ? N : K}" stroke="none"/>` +
          `<text x="150" y="254" font-size="24" font-weight="700" fill="${P}" stroke="none" text-anchor="middle" letter-spacing="2" class="zh">${label}</text>` : '')
      );
    },

    building() {
      return wrap(
        ground() +
        `<line x1="150" y1="78" x2="150" y2="40"/><path d="M150 40 L182 50 L150 60" fill="${A}" stroke-width="3"/>` +
        `<rect x="70" y="96" width="160" height="164" fill="${P}"/>` +
        `<rect x="62" y="80" width="176" height="16" fill="${N}" stroke="none"/>` +
        windows([88, 136, 184], [118, 154], 28, 22) + windows([88, 184], [190], 28, 22) +
        `<rect x="132" y="214" width="36" height="46" fill="${A}" stroke-width="3"/>`
      );
    },

    factory() {
      return wrap(
        ground() +
        `<rect x="198" y="64" width="22" height="80" fill="${NL}"/>` +
        `<path d="M206 50 Q214 40 226 44 M216 30 Q226 22 238 26" stroke-width="3"/>` +
        `<path d="M58 260 V138 L106 110 V138 L154 110 V138 L202 110 V138 L242 138 V260 Z" fill="${P}"/>` +
        windows([78, 126, 174], [164], 30, 26, AL) +
        `<rect x="124" y="212" width="52" height="48" fill="${N}" stroke="none"/>`
      );
    },

    field() {
      return wrap(
        `<ellipse cx="150" cy="162" rx="122" ry="76" fill="${AL}"/>` +
        `<ellipse cx="150" cy="162" rx="102" ry="58" stroke="${P}" stroke-width="2.5" stroke-dasharray="8 8"/>` +
        `<ellipse cx="150" cy="162" rx="82" ry="40" fill="${GREEN}"/>` +
        `<line x1="150" y1="122" x2="150" y2="202" stroke="${P}" stroke-width="3"/>` +
        `<circle cx="150" cy="162" r="13" stroke="${P}" stroke-width="3"/>`
      );
    },

    ball() {
      let net = '';
      for (let x = 72; x <= 228; x += 26) net += `<line x1="${x}" y1="180" x2="${x}" y2="224" stroke-width="2"/>`;
      for (let y = 192; y <= 216; y += 12) net += `<line x1="58" y1="${y}" x2="242" y2="${y}" stroke-width="2"/>`;
      return wrap(
        `<line x1="58" y1="168" x2="58" y2="260"/><line x1="242" y1="168" x2="242" y2="260"/>` +
        `<rect x="58" y="168" width="184" height="12" fill="${P}"/>` + net + ground(40, 260) +
        `<circle cx="110" cy="104" r="40" fill="${P}"/>` +
        `<path d="M80 82 Q110 98 110 144 M110 64 Q98 100 144 116 M72 116 Q108 108 136 76" stroke-width="3"/>` +
        `<circle cx="204" cy="112" r="28" fill="${AL}"/>` +
        `<path d="M182 96 Q204 112 186 132 M226 92 Q206 112 228 128" stroke-width="3"/>`
      );
    },

    gear() {
      return wrap(
        `<path d="${gear(126, 168, 80, 62, 10)}" fill="${NL}"/><circle cx="126" cy="168" r="22" fill="${P}"/>` +
        `<path d="${gear(212, 98, 48, 36, 8)}" fill="${A}"/><circle cx="212" cy="98" r="13" fill="${P}"/>`
      );
    },

    film() {
      let s1 = '', s2 = '';
      for (let i = 0; i < 5; i++) {
        s1 += `<path d="M${74 + i * 36} 86 L${92 + i * 36} 86 L${76 + i * 36} 116 L${58 + i * 36} 116 Z" fill="${N}" stroke="none"/>`;
        s2 += `<path d="M${74 + i * 36} 126 L${92 + i * 36} 126 L${76 + i * 36} 152 L${58 + i * 36} 152 Z" fill="${N}" stroke="none"/>`;
      }
      return wrap(
        `<rect x="58" y="126" width="184" height="134" fill="${P}"/>` + s2 +
        `<line x1="58" y1="152" x2="242" y2="152"/>` +
        `<line x1="80" y1="186" x2="220" y2="186" stroke="${NL}"/><line x1="80" y1="212" x2="180" y2="212" stroke="${NL}"/><line x1="80" y1="238" x2="200" y2="238" stroke="${NL}"/>` +
        `<g transform="rotate(-14 58 122)"><rect x="58" y="86" width="184" height="30" fill="${P}"/>${s1}</g>` +
        `<circle cx="58" cy="122" r="6" fill="${A}"/>`
      );
    },

    car() {
      return wrap(
        ground(34, 266, 234) +
        `<path d="M46 204 L54 166 Q60 152 86 150 L114 114 Q122 104 140 104 H194 Q208 104 218 118 L242 150 Q262 154 262 178 L262 204 Z" fill="${P}"/>` +
        `<path d="M100 150 L126 118 H148 V150 Z M162 150 V118 H192 Q200 118 206 126 L224 150 Z" fill="${NL}" stroke-width="3"/>` +
        `<line x1="48" y1="178" x2="262" y2="178" stroke="${A}" stroke-width="6"/>` +
        `<circle cx="96" cy="206" r="24" fill="${N}"/><circle cx="96" cy="206" r="9" fill="${P}"/>` +
        `<circle cx="214" cy="206" r="24" fill="${N}"/><circle cx="214" cy="206" r="9" fill="${P}"/>`
      );
    },

    book() {
      return wrap(
        `<path d="M42 106 Q96 92 150 112 Q204 92 258 106 V246 Q204 234 150 254 Q96 234 42 246 Z" fill="${N}" stroke="none"/>` +
        `<path d="M150 112 Q108 90 58 98 V230 Q108 222 150 242 Z" fill="${P}"/>` +
        `<path d="M150 112 Q192 90 242 98 V230 Q192 222 150 242 Z" fill="${P}"/>` +
        [130, 156, 182, 208].map(y => `<path d="M78 ${y - 6} Q104 ${y - 10} 132 ${y + 2}" stroke="${NL}" stroke-width="3"/><path d="M168 ${y + 2} Q196 ${y - 10} 222 ${y - 6}" stroke="${NL}" stroke-width="3"/>`).join('') +
        `<path d="M196 92 V136 L206 128 L216 136 V90" fill="${A}" stroke="none"/>`
      );
    },

    hall() {
      return wrap(
        `<path d="M46 118 L150 60 L254 118 Z" fill="${P}"/>` +
        `<circle cx="150" cy="98" r="10" fill="${A}" stroke="none"/>` +
        `<rect x="58" y="118" width="184" height="16" fill="${N}" stroke="none"/>` +
        [74, 116, 164, 206].map(x => `<rect x="${x}" y="134" width="20" height="98" fill="${P}"/>`).join('') +
        `<rect x="50" y="232" width="200" height="12" fill="${NL}"/><rect x="40" y="244" width="220" height="14" fill="${P}"/>`
      );
    },

    chip() {
      let pins = '';
      for (let i = 0; i < 4; i++) {
        const p = 112 + i * 25;
        pins += `<line x1="${p}" y1="72" x2="${p}" y2="96"/><line x1="${p}" y1="204" x2="${p}" y2="228"/><line x1="72" y1="${p}" x2="96" y2="${p}"/><line x1="204" y1="${p}" x2="228" y2="${p}"/>`;
      }
      return wrap(
        pins + `<rect x="94" y="94" width="112" height="112" rx="8" fill="${N}" stroke="none"/>` +
        `<rect x="116" y="116" width="68" height="68" rx="4" stroke="${P}" stroke-width="3"/>` +
        `<path d="M156 124 L136 154 H152 L144 176 L166 144 H150 Z" fill="${A}" stroke="none"/>`
      );
    },

    moon() {
      return wrap(
        `<path d="M184 56 A68 68 0 1 0 238 150 A54 54 0 1 1 184 56 Z" fill="${AL}"/>` +
        `<circle cx="86" cy="80" r="3.5" fill="${K}" stroke="none"/><circle cx="118" cy="56" r="2.5" fill="${K}" stroke="none"/><circle cx="252" cy="80" r="3" fill="${K}" stroke="none"/>` +
        `<rect x="52" y="174" width="150" height="86" fill="${P}"/>` +
        windows([68, 110, 152], [192, 224], 30, 20, A) + ground(36, 264)
      );
    },

    blocks() { // 幼保：大人牽著孩子
      return wrap(
        ground() +
        `<circle cx="116" cy="88" r="20" fill="${N}" stroke="none"/>` +
        `<path d="M90 260 L94 172 Q96 124 116 120 Q136 124 138 172 L142 260 Z" fill="${N}" stroke="none"/>` +
        `<circle cx="196" cy="150" r="15" fill="${A}" stroke="none"/>` +
        `<path d="M176 260 L178 204 Q180 176 196 174 Q212 176 214 204 L216 260 Z" fill="${A}" stroke="none"/>` +
        `<path d="M136 170 Q160 196 182 196" stroke-width="5"/>`
      );
    },

    chair() {
      return wrap(
        `<rect x="106" y="46" width="88" height="60" fill="${P}"/><path d="M116 96 L140 72 L154 86 L168 74 L184 96" stroke-width="3"/>` +
        `<rect x="84" y="122" width="132" height="84" rx="16" fill="${A}"/>` +
        `<rect x="68" y="176" width="164" height="42" rx="10" fill="${AL}"/>` +
        `<rect x="52" y="150" width="30" height="76" rx="10" fill="${P}"/><rect x="218" y="150" width="30" height="76" rx="10" fill="${P}"/>` +
        `<line x1="78" y1="226" x2="72" y2="258"/><line x1="222" y1="226" x2="228" y2="258"/>`
      );
    },

    scissors() {
      let teeth = '';
      for (let y = 88; y <= 234; y += 13) teeth += `<line x1="96" y1="${y}" x2="114" y2="${y}" stroke-width="3"/>`;
      return wrap(
        `<rect x="58" y="72" width="40" height="178" rx="6" fill="${NL}"/>` + teeth +
        `<path d="M156 198 L234 70 L244 76 L176 208 Z" fill="${P}"/>` +
        `<path d="M200 198 L150 72 L140 78 L178 210 Z" fill="${P}"/>` +
        `<circle cx="160" cy="226" r="24" stroke="${A}" stroke-width="9"/>` +
        `<circle cx="218" cy="222" r="24" stroke="${A}" stroke-width="9"/>`
      );
    },

    computer(kind = 'code') {
      const screen = kind === 'chart'
        ? `<rect x="90" y="140" width="20" height="32" fill="${NL}" stroke="none"/><rect x="124" y="120" width="20" height="52" fill="${A}" stroke="none"/><rect x="158" y="130" width="20" height="42" fill="${NL}" stroke="none"/><rect x="192" y="102" width="20" height="70" fill="${A}" stroke="none"/><path d="M90 118 L132 98 L168 108 L210 84" stroke-width="3"/>`
        : `<text x="150" y="152" font-size="54" font-weight="600" text-anchor="middle" fill="${A}" stroke="none" class="num">&lt;/&gt;</text>`;
      return wrap(
        `<rect x="54" y="66" width="192" height="132" rx="6" fill="${N}" stroke="none"/>` +
        `<rect x="68" y="80" width="164" height="104" fill="${P}" stroke="none"/>` + screen +
        `<path d="M132 198 L126 234 H174 L168 198" fill="${NL}"/><line x1="96" y1="236" x2="204" y2="236" stroke-width="6"/>`
      );
    },
    chart() { return I.computer('chart'); },

    chef() {
      return wrap(
        `<path d="M98 148 Q70 148 70 120 Q70 90 104 92 Q114 62 150 62 Q186 62 196 92 Q230 90 230 120 Q230 148 202 148 Z" fill="${P}"/>` +
        `<rect x="98" y="146" width="104" height="38" fill="${P}"/><line x1="98" y1="166" x2="202" y2="166" stroke="${A}" stroke-width="5"/>` +
        `<path d="M64 212 H236 Q230 258 150 258 Q70 258 64 212 Z" fill="${N}" stroke="none"/>` +
        `<line x1="56" y1="212" x2="244" y2="212"/>`
      );
    },

    abc() {
      return wrap(
        `<path d="M50 72 H202 Q214 72 214 84 V156 Q214 168 202 168 H114 L82 194 L88 168 H62 Q50 168 50 156 V84 Q50 72 62 72 Z" fill="${P}"/>` +
        `<text x="132" y="138" font-size="50" font-weight="600" text-anchor="middle" fill="${N}" stroke="none" class="num" letter-spacing="2">ABC</text>` +
        `<path d="M150 184 H238 Q250 184 250 196 V244 Q250 256 238 256 H226 L230 276 L206 256 H162 Q150 256 150 244 V196 Q150 184 162 184 Z" fill="${A}" stroke="none"/>` +
        `<text x="200" y="232" font-size="36" font-weight="700" text-anchor="middle" fill="${P}" stroke="none" class="zh">外語</text>`
      );
    },

    cap(pause) {
      return wrap(
        `<rect x="70" y="212" width="124" height="34" rx="17" fill="${P}"/><line x1="132" y1="208" x2="132" y2="250" stroke="${A}" stroke-width="8"/>` +
        `<path d="M94 132 V178 Q150 204 206 178 V132" fill="${N}" stroke="none"/>` +
        `<path d="M38 124 L150 82 L262 124 L150 166 Z" fill="${N}" stroke="${K}"/>` +
        `<path d="M150 124 L230 140 V186" stroke="${A}" stroke-width="4"/><rect x="224" y="184" width="12" height="26" fill="${A}" stroke="none"/>` +
        (pause ? `<circle cx="226" cy="228" r="34" fill="${P}"/><line x1="216" y1="214" x2="216" y2="242" stroke-width="7"/><line x1="236" y1="214" x2="236" y2="242" stroke-width="7"/>` : '')
      );
    },
    capPause() { return I.cap(true); },

    suitcase() {
      return wrap(
        `<path d="M120 108 V86 Q120 76 130 76 H170 Q180 76 180 86 V108" stroke-width="7"/>` +
        `<rect x="64" y="106" width="172" height="138" rx="10" fill="${P}"/>` +
        `<line x1="108" y1="106" x2="108" y2="244" stroke="${A}" stroke-width="7"/><line x1="192" y1="106" x2="192" y2="244" stroke="${A}" stroke-width="7"/>` +
        `<circle cx="92" cy="256" r="8" fill="${N}" stroke="none"/><circle cx="208" cy="256" r="8" fill="${N}" stroke="none"/>` +
        `<path d="M206 54 L258 40 L250 50 L232 56 L226 72 L219 74 L219 58 L206 62 Z" fill="${N}" stroke="none"/>`
      );
    },

    medal() {
      return wrap(
        `<path d="M108 48 L138 130 L116 138 L82 56 Z" fill="${A}" stroke="none"/><path d="M192 48 L162 130 L184 138 L218 56 Z" fill="${N}" stroke="none"/>` +
        `<circle cx="150" cy="184" r="64" fill="${GOLD}"/><circle cx="150" cy="184" r="48" stroke="${P}" stroke-width="3"/>` +
        `<path d="${star(150, 186, 30, 13)}" fill="${P}" stroke="none"/>`
      );
    },

    palette() {
      return wrap(
        `<path d="M150 58 C212 58 254 100 250 152 C246 192 212 192 194 182 C176 172 166 196 176 218 C188 246 150 256 124 248 C74 234 50 196 52 152 C56 98 96 58 150 58 Z" fill="${P}"/>` +
        `<circle cx="106" cy="118" r="15" fill="${A}" stroke="none"/><circle cx="150" cy="98" r="15" fill="${N}" stroke="none"/>` +
        `<circle cx="198" cy="116" r="15" fill="${BLUE}" stroke="none"/><circle cx="92" cy="172" r="15" fill="${GREEN}" stroke="none"/>` +
        `<line x1="226" y1="190" x2="262" y2="258" stroke-width="8"/>`
      );
    },

    dress() {
      return wrap(
        `<path d="M150 70 Q150 46 164 46 Q178 46 176 60" stroke-width="3.5"/>` +
        `<path d="M150 70 L84 104 H216 Z" stroke="${N}" stroke-width="5"/>` +
        `<path d="M124 94 L134 128 Q122 158 116 170 L78 258 H222 L184 170 Q178 158 166 128 L176 94 Q162 104 150 104 Q138 104 124 94 Z" fill="${A}" stroke="none"/>` +
        `<line x1="118" y1="168" x2="182" y2="168" stroke="${P}" stroke-width="5"/>`
      );
    },

    dorm() {
      return wrap(
        ground() +
        `<path d="M44 124 L150 62 L256 124 Z" fill="${N}" stroke="none"/>` +
        `<rect x="64" y="122" width="172" height="138" fill="${P}"/>` +
        windows([84, 134, 184], [144, 194], 32, 28, AL) +
        `<rect x="134" y="228" width="32" height="32" fill="${A}" stroke="none"/>`
      );
    },

    faucet() {
      return wrap(
        `<path d="M42 114 H150 Q194 114 194 158 V172 H166 V160 Q166 144 148 144 H42 Z" fill="${NL}"/>` +
        `<rect x="98" y="84" width="16" height="30" fill="${P}"/><line x1="76" y1="78" x2="136" y2="78" stroke-width="8"/>` +
        `<path d="M180 192 Q166 214 180 228 Q194 214 180 192 Z" fill="${BLUE}" stroke="none"/>` +
        `<path d="M246 60 L214 122 H236 L220 184 L262 106 H238 Z" fill="${A}" stroke="none"/>`
      );
    },

    artbuilding() {
      return wrap(
        ground() +
        `<rect x="58" y="92" width="184" height="168" fill="${P}"/>` +
        `<path d="M58 112 Q58 72 100 72 H200 Q242 72 242 112 Z" fill="${A}" stroke="none"/>` +
        windows([76, 196], [132, 184], 28, 34) +
        `<circle cx="140" cy="186" r="13" fill="${N}" stroke="none"/><path d="M152 186 V128 L180 136 V152" stroke-width="5"/>` +
        `<rect x="122" y="226" width="56" height="34" fill="${N}" stroke="none"/>`
      );
    },

    gamepad() {
      return wrap(
        `<path d="M84 110 H216 Q258 110 262 168 Q266 226 234 226 Q214 226 198 200 H102 Q86 226 66 226 Q34 226 38 168 Q42 110 84 110 Z" fill="${N}" stroke="none"/>` +
        `<path d="M82 150 H96 V136 H110 V150 H124 V164 H110 V178 H96 V164 H82 Z" fill="${P}" stroke="none"/>` +
        `<circle cx="200" cy="146" r="9" fill="${A}" stroke="none"/><circle cx="222" cy="168" r="9" fill="${P}" stroke="none"/>` +
        `<circle cx="178" cy="168" r="9" fill="${P}" stroke="none"/><circle cx="200" cy="190" r="9" fill="${A}" stroke="none"/>`
      );
    },

    globe() {
      return wrap(
        `<path d="M80 128 A84 84 0 0 0 222 212" stroke="${N}" stroke-width="7"/>` +
        `<line x1="150" y1="230" x2="150" y2="254" stroke-width="6"/><line x1="110" y1="258" x2="190" y2="258" stroke-width="7"/>` +
        `<circle cx="156" cy="136" r="74" fill="${BLUE}"/>` +
        `<path d="M112 96 Q132 86 144 100 Q148 120 130 126 Q120 142 104 132 Q98 112 112 96 Z" fill="${GREEN}" stroke="none"/>` +
        `<path d="M166 108 Q194 96 210 118 Q218 148 198 158 Q186 182 166 172 Q174 148 158 134 Q154 118 166 108 Z" fill="${GREEN}" stroke="none"/>` +
        `<ellipse cx="156" cy="136" rx="74" ry="24" stroke="${P}" stroke-width="2"/><line x1="156" y1="62" x2="156" y2="210" stroke="${P}" stroke-width="2"/>`
      );
    },

    bus() {
      return wrap(
        ground(30, 270, 236) +
        `<rect x="42" y="98" width="216" height="114" rx="12" fill="${A}" stroke="none"/>` +
        windows([60, 104, 148], [116], 36, 38, P) +
        `<rect x="202" y="116" width="38" height="78" fill="${P}" stroke-width="3"/>` +
        `<line x1="42" y1="176" x2="196" y2="176" stroke="${P}" stroke-width="4"/>` +
        `<circle cx="90" cy="214" r="20" fill="${N}" stroke="none"/><circle cx="90" cy="214" r="7" fill="${P}" stroke="none"/>` +
        `<circle cx="210" cy="214" r="20" fill="${N}" stroke="none"/><circle cx="210" cy="214" r="7" fill="${P}" stroke="none"/>`
      );
    },

    rebuild() {
      let lattice = '';
      for (let y = 66; y < 254; y += 24) lattice += `<path d="M206 ${y} L224 ${y + 24} M224 ${y} L206 ${y + 24}" stroke-width="2.5"/>`;
      return wrap(
        ground(34, 266) +
        `<rect x="206" y="58" width="18" height="202" fill="${GOLD}"/>` + lattice +
        `<rect x="62" y="46" width="196" height="14" fill="${GOLD}"/>` +
        `<line x1="98" y1="60" x2="98" y2="108" stroke-width="3"/><rect x="86" y="108" width="24" height="18" fill="${A}" stroke="none"/>` +
        `<rect x="52" y="170" width="136" height="90" fill="${P}"/><rect x="52" y="144" width="136" height="26" stroke-dasharray="8 7"/>` +
        windows([68, 106, 144], [186, 220], 26, 20)
      );
    },
  };

  window.ICONS = I;
})();
