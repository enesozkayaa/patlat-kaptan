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
  // Osuruk: gerçekçi olsun diye 'dudak çırpması' gibi düzensiz darbelerden oluşan bir ses
  // önceden üretilir (birkaç farklı çeşit), basılı tuttukça döngüde çalar, bırakınca 'pfff' diye söner.
  const aktif = new Map();
  let tamponlar = null;
  function tamponUret(c, tohum) {
    const sr = c.sampleRate, n = Math.floor(sr * 4), buf = c.createBuffer(1, n, sr), v = buf.getChannelData(0);
    let r = tohum; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    let faz = 0, f = 60, hedefF = 60, sayac = 0, genlik = 1, bosluk = 0, yavas = 0, yavasHiz = 4 + rnd() * 4;
    let ince = 0;   // ara sıra ince ıslık gibi yükselen kısım
    for (let i = 0; i < n; i++) {
      if (--sayac <= 0) { hedefF = 38 + rnd() * 70 + (rnd() < 0.12 ? 60 : 0); sayac = sr * (0.04 + rnd() * 0.18); ince = rnd() < 0.08 ? 1 : 0; }
      f += (hedefF - f) * 0.0009;
      yavas += yavasHiz / sr;
      faz += (f * (1 + ince * 0.6)) / sr;
      if (faz >= 1) {
        faz -= 1;
        genlik = 0.45 + rnd() * 0.75;
        if (bosluk > 0) bosluk--; else if (rnd() < 0.035) bosluk = 1 + Math.floor(rnd() * 3);   // kısa kesilmeler: pırt-pırt
      }
      const x = faz;
      const darbe = Math.exp(-x * 7) * (1 - Math.exp(-x * 90));          // dudak açılıp kapanıyor
      const hava = (rnd() * 2 - 1) * 0.35 * Math.exp(-x * 3.5);           // ıslak hava
      const zarf = 0.75 + 0.25 * Math.sin(yavas * Math.PI * 2);
      v[i] = bosluk > 0 ? (rnd() * 2 - 1) * 0.04 : (darbe * 1.6 - 0.35 + hava) * genlik * zarf;
    }
    // uçları yumuşat (döngüde tık sesi olmasın)
    const k = Math.floor(sr * 0.01); for (let i = 0; i < k; i++) { v[i] *= i / k; v[n - 1 - i] *= i / k; }
    return buf;
  }
  function osurukBasla(anahtar, ses = 1) {
    const c = al(); if (!c || !acik || ses < 0.02 || aktif.has(anahtar)) return;
    if (!tamponlar) tamponlar = [7, 911, 4242].map(t => tamponUret(c, t));
    const t = c.currentTime;
    const kay = c.createBufferSource(); kay.buffer = tamponlar[Math.floor(Math.random() * tamponlar.length)]; kay.loop = true;
    kay.playbackRate.value = 0.8 + Math.random() * 0.4;
    const alt = c.createBiquadFilter(); alt.type = 'lowpass'; alt.frequency.value = 1100; alt.Q.value = 0.7;
    const gov = c.createBiquadFilter(); gov.type = 'peaking'; gov.frequency.value = 170; gov.gain.value = 7; gov.Q.value = 1.1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * ses, t + 0.012);
    kay.connect(alt).connect(gov).connect(g).connect(c.destination);
    kay.start(t, Math.random() * 3.5);
    // tonu ara ara hafifçe kaydır (her osuruk biraz farklı)
    const zaman = setInterval(() => { try { kay.playbackRate.setTargetAtTime(0.75 + Math.random() * 0.5, c.currentTime, 0.15); } catch (e) { } }, 350);
    aktif.set(anahtar, { kay, g, zaman, ses });
  }
  function osurukBitir(anahtar) {
    const a = aktif.get(anahtar); if (!a) return;
    aktif.delete(anahtar); clearInterval(a.zaman);
    const c = al(); if (!c) return; const t = c.currentTime;
    try {
      a.kay.playbackRate.cancelScheduledValues(t); a.kay.playbackRate.setValueAtTime(a.kay.playbackRate.value, t);
      a.kay.playbackRate.linearRampToValueAtTime(0.45, t + 0.16);                  // sönerken ton düşer: pfff
      a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(a.g.gain.value, t);
      a.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    } catch (e) { }
    gurultu(0.22, 0.12 * a.ses, 900, 'bandpass', 0.02, 300);                       // son hava
    setTimeout(() => { try { a.kay.stop(); a.g.disconnect(); } catch (e) { } }, 300);
  }
  function osurukHepsiBitir() { [...aktif.keys()].forEach(osurukBitir); }

  return {
    osurukBasla, osurukBitir, osurukHepsiBitir,
    pirt() { osurukBasla('pirt', 0.7); setTimeout(() => osurukBitir('pirt'), 90); },
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
