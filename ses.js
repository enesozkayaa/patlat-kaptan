// =============================================================
// Patlat Kaptan - oyun sesleri (dosya yok, tarayıcı kendisi üretir). Sesli sohbet ayrı (ag.js).
// =============================================================

const Ses = (() => {
  let acik = true;
  try { acik = localStorage.getItem('pk.ses') !== '0'; } catch (e) { }
  const al = () => (typeof Ag !== 'undefined' ? Ag.ctxAl() : null);
  function ton(frek, sure, tip = 'sine', ses = 0.15, gecikme = 0, kayma = 0) {
    const c = al(); if (!c || !acik || ses < 0.003) return;
    const t = c.currentTime + gecikme;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tip; o.frequency.setValueAtTime(frek, t);
    if (kayma) o.frequency.exponentialRampToValueAtTime(Math.max(30, frek + kayma), t + sure);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(ses, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + sure + 0.02);
  }
  function gurultu(sure, ses = 0.5, filtre = 1200, tip = 'lowpass', gecikme = 0, sonFiltre = 0) {
    const c = al(); if (!c || !acik || ses < 0.01) return;
    const n = Math.floor(c.sampleRate * sure), buf = c.createBuffer(1, n, c.sampleRate), v = buf.getChannelData(0);
    for (let i = 0; i < n; i++) v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = tip; f.frequency.value = filtre; g.gain.value = ses;
    if (sonFiltre) f.frequency.exponentialRampToValueAtTime(sonFiltre, c.currentTime + gecikme + sure);
    s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + gecikme);
  }
  // Osuruk: basılı tuttukça süren, tonu titreyen bir 'prrrrt'. anahtar başına bir tane.
  const aktif = new Map();
  let gurultuTampon = null;
  function osurukBasla(anahtar, ses = 1) {
    const c = al(); if (!c || !acik || ses < 0.02 || aktif.has(anahtar)) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 75 + Math.random() * 45;
    const lfo = c.createOscillator(); lfo.frequency.value = 10 + Math.random() * 9;
    const lg = c.createGain(); lg.gain.value = 22; lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * ses, t + 0.03);
    if (!gurultuTampon) { const n = c.sampleRate; gurultuTampon = c.createBuffer(1, n, n); const v = gurultuTampon.getChannelData(0); for (let i = 0; i < n; i++) v[i] = Math.random() * 2 - 1; }
    const nz = c.createBufferSource(); nz.buffer = gurultuTampon; nz.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 260; nf.Q.value = 1.2;
    const ng = c.createGain(); ng.gain.value = 0.5;
    o.connect(f).connect(g); nz.connect(nf).connect(ng).connect(g); g.connect(c.destination);
    o.start(t); lfo.start(t); nz.start(t);
    // ton ve titreşim rastgele kaysın (komik olsun)
    const zaman = setInterval(() => { const tt = c.currentTime; o.frequency.setTargetAtTime(60 + Math.random() * 80, tt, 0.06); lfo.frequency.setTargetAtTime(7 + Math.random() * 16, tt, 0.05); }, 130);
    aktif.set(anahtar, { o, lfo, nz, g, zaman });
  }
  function osurukBitir(anahtar) {
    const a = aktif.get(anahtar); if (!a) return;
    aktif.delete(anahtar); clearInterval(a.zaman);
    const c = al(); const t = c ? c.currentTime : 0;
    try { a.o.frequency.setTargetAtTime(45, t, 0.05); a.g.gain.setTargetAtTime(0.0001, t + 0.05, 0.04); } catch (e) { }
    setTimeout(() => { try { a.o.stop(); a.lfo.stop(); a.nz.stop(); a.g.disconnect(); } catch (e) { } }, 350);
  }
  function osurukHepsiBitir() { [...aktif.keys()].forEach(osurukBitir); }

  return {
    osurukBasla, osurukBitir, osurukHepsiBitir,
    pirt() { ton(110, 0.09, 'sawtooth', 0.12, 0, -40); ton(90, 0.07, 'sawtooth', 0.1, 0.11, -30); },
    get acik() { return acik; },
    degistir() { acik = !acik; if (!acik) osurukHepsiBitir(); try { localStorage.setItem('pk.ses', acik ? '1' : '0'); } catch (e) { } return acik; },
    baslat() { al(); },
    // Çalkalama tıkırtısı (basınca göre incelir)
    calkala(b) { gurultu(0.06, 0.12 + b * 0.15, 900 + b * 2500, 'bandpass'); ton(220 + b * 500, 0.05, 'triangle', 0.025); },
    // Fışşş! (gücüne göre uzun)
    fiskir(g = 1, s = 1) { const sure = 0.3 + g * 1.1; ton(1500, 0.06, 'square', 0.05 * s); gurultu(sure, 0.5 * s, 5000, 'bandpass', 0.02, 1800); gurultu(sure * 0.8, 0.25 * s, 900, 'lowpass', 0.05); },
    patla(s = 1) { gurultu(0.6, 1.0 * s, 3000, 'lowpass', 0, 300); ton(90, 0.4, 'sine', 0.4 * s, 0, -50); gurultu(1.2, 0.3 * s, 6000, 'highpass', 0.1); [0.1, 0.18, 0.27].forEach(g => ton(2500 + Math.random() * 2000, 0.05, 'triangle', 0.05 * s, g)); },
    sicrama(s = 1) { gurultu(0.7, 0.7 * s, 1800, 'lowpass'); gurultu(0.35, 0.4 * s, 500, 'bandpass', 0.05); },
    carpma(s = 1) { gurultu(0.2, 0.7 * s, 400); ton(80, 0.25, 'triangle', 0.25 * s, 0, -30); },
    devril() { ton(300, 0.6, 'sawtooth', 0.07, 0, -220); gurultu(0.9, 0.6, 1200, 'lowpass', 0.3); },
    dusus() { ton(900, 1.0, 'sine', 0.1, 0, -750); },
    kontrol() { [659, 880, 1175].forEach((f, i) => ton(f, 0.2, 'triangle', 0.12, i * 0.08)); },
    tik() { ton(660, 0.12, 'square', 0.08); },
    basla() { ton(990, 0.5, 'square', 0.1); ton(1320, 0.5, 'square', 0.06, 0.05); },
    bildirim() { ton(880, 0.12, 'sine', 0.12); ton(1320, 0.18, 'sine', 0.1, 0.12); },
    yuz() { gurultu(0.25, 0.12, 900, 'bandpass'); },
    kazandi() { [523, 659, 784, 1046, 1318].forEach((f, i) => ton(f, 0.28, 'triangle', 0.13, i * 0.11)); },
    kaybetti() { [392, 330, 262, 196].forEach((f, i) => ton(f, 0.3, 'triangle', 0.12, i * 0.16)); },
  };
})();
