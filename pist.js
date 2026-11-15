// =============================================================
// Çalkala Kaptan - pist: dağın etrafında dolana dolana YUKARI çıkan nehir.
// Su aşağı akar, tekneler akıntıya karşı tırmanır. Virajın dış kenarında
// korkuluk olmayan yerden düşen bir alt kattaki nehre düşer.
// Hem tarayıcıda hem Node'da (testler) çalışır.
// =============================================================

const Pist = (() => {
  const YARI = 4.5;                 // nehrin yarı genişliği (9 m)
  const R0 = 58;                    // en alttaki halkanın yarıçapı
  const KAT_R = 11;                 // her halkada yarıçap bu kadar küçülür (alt halka dışarıda kalır)
  const KAT_Y = 9;                  // her halkada bu kadar yükselir
  const TUR = 3.25;                 // kaç halka
  const RAMPA = 3;                  // her halkada kaç rampa (her biri KAT_Y/3 m)
  const GOL_Y = -3;                 // dağın dibindeki göl
  const TMAX = TUR * Math.PI * 2;
  const k = KAT_R / (Math.PI * 2);

  const yaricap = t => R0 - k * t;
  const smooth = u => u * u * (3 - 2 * u);
  function yukseklik(t) {
    const u = t / (Math.PI * 2) * RAMPA, n = Math.floor(u), f = u - n;
    const g = f < 0.72 ? 0 : smooth((f - 0.72) / 0.28);
    return (KAT_Y / RAMPA) * (n + g);
  }

  // Örnek noktalar (yaklaşık 1,5 m arayla)
  const P = [];
  let s = 0;
  for (let t = 0; t <= TMAX; ) {
    const r = yaricap(t);
    const x = r * Math.sin(t), z = r * Math.cos(t);
    if (P.length) { const q = P[P.length - 1]; s += Math.hypot(x - q.x, z - q.z); }
    P.push({ t, r, x, z, y: yukseklik(t), s });
    t += 1.5 / r;
  }
  const N = P.length, L = P[N - 1].s;
  for (let i = 0; i < N; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    const p = P[i];
    p.tx = dx / d; p.tz = dz / d;                                  // yukarı (ileri) yön
    p.nx = p.tz; p.nz = -p.tx;                                     // dışarı yön
    if (p.nx * p.x + p.nz * p.z < 0) { p.nx = -p.nx; p.nz = -p.nz; }
    p.egim = (b.y - a.y) / d;                                      // rampa dikliği
  }

  // Korkuluklar: başta ve sonda hep var, arada bazı yerlerde boşluk (düşülebilir)
  const korkuluk = P.map(p => p.s < 70 || p.s > L - 45 || Math.floor(p.s / 40) % 3 !== 1);

  // Kontrol noktaları (5 ara + bitiş)
  const KONTROL = [1, 2, 3, 4, 5].map(n => endeks(L * n / 6));
  const BITIS = endeks(L - 5);
  function endeks(sx) { let i = 0; while (i < N - 1 && P[i].s < sx) i++; return i; }

  // Engeller: kayalar ve girdaplar (herkeste aynı)
  const KAYALAR = [], GIRDAPLAR = [];
  for (let sx = 95, j = 0; sx < L - 40; sx += 47, j++) {
    if (KONTROL.some(c => Math.abs(P[c].s - sx) < 12)) continue;
    const p = P[endeks(sx)], d = (j % 2 ? 1 : -1) * (1.6 + (j % 3) * 0.6);
    KAYALAR.push({ x: p.x + p.nx * d, z: p.z + p.nz * d, y: p.y, r: 0.85 + (j % 2) * 0.25, i: endeks(sx) });
  }
  for (let sx = 150; sx < L - 60; sx += 165) {
    const p = P[endeks(sx)];
    GIRDAPLAR.push({ x: p.x, z: p.z, y: p.y, r: 3.2, i: endeks(sx) });
  }

  // Bir noktaya en yakın örnek. ipucu verilirse çevresine bakar (hızlı).
  // Dönen: { i, d (dışarı +), a (ileri), y (su yüzeyi) } ya da null
  function bul(x, z, y, ipucu = -1) {
    let en = -1, enD = Infinity;
    const bas = ipucu >= 0 ? Math.max(0, ipucu - 30) : 0, son = ipucu >= 0 ? Math.min(N - 1, ipucu + 30) : N - 1;
    for (let i = bas; i <= son; i++) {
      const p = P[i];
      if (y !== null && Math.abs(p.y - y) > 4.5) continue;
      const dd = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (dd < enD) { enD = dd; en = i; }
    }
    if (en < 0) return ipucu >= 0 ? bul(x, z, y, -1) : null;
    if (ipucu >= 0 && (en === bas || en === son) && bas !== 0 && son !== N - 1) return bul(x, z, y, -1);
    const p = P[en];
    const ox = x - p.x, oz = z - p.z;
    const a = ox * p.tx + oz * p.tz, d = ox * p.nx + oz * p.nz;
    const q = P[Math.min(N - 1, en + 1)], o = P[Math.max(0, en - 1)];
    const yy = a >= 0 ? p.y + (q.y - p.y) * Math.min(1, a / 1.5) : p.y + (p.y - o.y) * Math.max(-1, a / 1.5);
    return { i: en, d, a, y: yy };
  }

  // Havadan düşen bir şey nereye iner? yEski → yYeni arasında kalan nehir yüzeyi (en yükseği)
  function inis(x, z, yEski, yYeni) {
    let en = -1;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (p.y > yEski + 0.05 || p.y < yYeni - 0.05) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 > (YARI + 0.4) ** 2) continue;
      const ox = x - p.x, oz = z - p.z;
      if (Math.abs(ox * p.tx + oz * p.tz) > 1.0) continue;
      if (en < 0 || p.y > P[en].y) en = i;
    }
    return en;
  }

  // Akıntı ivmesi (aşağı doğru): düzde hafif, rampada güçlü
  const akinti = i => 0.3 + Math.max(0, P[i].egim) * 3.5;

  // Başlangıç yerleri (en fazla 4 tekne)
  function baslangic(no) {
    const p = P[endeks(no < 2 ? 16 : 9)], d = no % 2 ? 2.2 : -2.2;
    return { x: p.x + p.nx * d, z: p.z + p.nz * d, y: p.y, yaw: Math.atan2(p.tx, p.tz) };
  }
  // Kontrol noktasından yeniden başlama yeri
  function kontrolYeri(c, no = 0) {
    const i = c < 0 ? endeks(12) : KONTROL[c];
    const p = P[Math.min(N - 1, i + 2)], d = [-2.2, 2.2, 0, -1][no % 4];
    return { x: p.x + p.nx * d, z: p.z + p.nz * d, y: p.y, yaw: Math.atan2(p.tx, p.tz), i: Math.min(N - 1, i + 2) };
  }

  return { YARI, R0, KAT_R, KAT_Y, GOL_Y, P, N, L, korkuluk, KONTROL, BITIS, KAYALAR, GIRDAPLAR, bul, inis, akinti, baslangic, kontrolYeri, endeks, yukseklik, yaricap };
})();
if (typeof module !== 'undefined') module.exports = Pist;
