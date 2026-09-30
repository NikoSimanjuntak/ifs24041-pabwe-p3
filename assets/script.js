'use strict';

/* ==========================================================
   LEMBAR — Expense Tracker, Bookmark Manager, Quiz App
   Bagian: 1 Utilitas · 2 Modal · 3 Tab · 4 Pengeluaran
           5 Bookmark · 6 Kuis
   ========================================================== */

/* ---------- 1. Utilitas ---------- */
// Setiap fitur memakai key localStorage sendiri agar data tidak bentrok
const KEY = {
  tab: 'lembar:tab-aktif',
  tx: 'lembar:transaksi',
  bm: 'lembar:bookmark',
  skor: 'lembar:skor-tertinggi',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape teks agar aman dimasukkan ke innerHTML
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* penyimpanan penuh/dinonaktifkan */ }
  },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const tglIndo = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const hariIni = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const daftar = (v) => (Array.isArray(v) ? v : []);

let toastTimer;
function toast(pesan) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = pesan;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

// Markup satu field form (label + kontrol + tempat pesan error)
const field = (label, name, kontrol) =>
  `<label class="fld"><span>${label}</span>${kontrol}<small class="err" data-err="${name}"></small></label>`;
const opsi = (arr, terpilih, placeholder) =>
  (placeholder ? `<option value="">${placeholder}</option>` : '') +
  arr.map((o) => `<option${o === terpilih ? ' selected' : ''}>${esc(o)}</option>`).join('');

// Validasi form: rules = { namaField: (nilai) => pesanError | '' }
function validasi(form, rules) {
  let valid = true;
  let pertama = null;
  for (const [nama, cek] of Object.entries(rules)) {
    const input = form.elements[nama];
    const pesan = cek(input.value.trim());
    $(`[data-err="${nama}"]`, form).textContent = pesan;
    input.setAttribute('aria-invalid', String(Boolean(pesan)));
    if (pesan) { valid = false; pertama ??= input; }
  }
  pertama?.focus();
  return valid;
}

/* ---------- 2. Modal (ubah & hapus) ---------- */
const modal = {
  el: $('#modal'),
  box: $('#modal-box'),
  pemicu: null,
  buka({ judul, isi, tombol = 'Simpan', bahaya = false, onSubmit }) {
    this.pemicu = document.activeElement;
    this.box.innerHTML = `
      <h2 id="modal-title">${esc(judul)}</h2>
      <form id="modal-form" novalidate>${isi}
        <div class="actions">
          <button type="button" class="btn ghost" data-tutup>Batal</button>
          <button class="btn ${bahaya ? 'danger' : 'primary'}">${esc(tombol)}</button>
        </div>
      </form>`;
    this.el.hidden = false;
    document.body.classList.add('lock');
    const form = $('#modal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (onSubmit(form) !== false) this.tutup();
    });
    (form.querySelector('input, select, textarea') || form.querySelector('.btn:not(.ghost)')).focus();
  },
  tutup() {
    this.el.hidden = true;
    document.body.classList.remove('lock');
    this.pemicu?.focus?.();
  },
};
modal.el.addEventListener('click', (e) => {
  if (e.target === modal.el || e.target.hasAttribute('data-tutup')) modal.tutup();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.el.hidden) modal.tutup();
});

/* ---------- 3. Navigasi tab ---------- */
const tabs = $$('.tab');
const panels = $$('[role="tabpanel"]');

// Setiap tab punya path sendiri (dirutekan ke index.html lewat file _redirects)
const JALUR = { tx: '/pengeluaran', bm: '/tautan', kuis: '/kuis' };
const JUDUL = { tx: 'Catatan Pengeluaran', bm: 'Manajer Tautan', kuis: 'Kuis Interaktif' };

const tabDariUrl = () => {
  const path = location.pathname.replace(/\/+$/, '').toLowerCase();
  return Object.keys(JALUR).find((k) => JALUR[k] === path) ?? null;
};

// riwayat: 'push' (klik tab) | null (tidak mengubah URL)
function pilihTab(id, { fokus = false, riwayat = 'push' } = {}) {
  if (!JALUR[id]) id = 'tx';
  tabs.forEach((t) => {
    const aktif = t.dataset.tab === id;
    t.setAttribute('aria-selected', String(aktif));
    t.tabIndex = aktif ? 0 : -1;
    if (aktif && fokus) t.focus();
  });
  panels.forEach((p) => { p.hidden = p.id !== `panel-${id}`; });
  document.title = `${JUDUL[id]} — Lembar`;
  store.set(KEY.tab, id); // ingat tab terakhir
  // Ubah URL hanya di http(s); dibuka langsung dari file:// tidak didukung pushState
  if (riwayat && location.protocol.startsWith('http') && location.pathname.replace(/\/+$/, '') !== JALUR[id]) {
    try { history.pushState({ tab: id }, '', JALUR[id]); } catch { /* abaikan */ }
  }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pilihTab(t.dataset.tab));
  t.addEventListener('keydown', (e) => {
    const geser = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (geser) pilihTab(tabs[(i + geser + tabs.length) % tabs.length].dataset.tab, { fokus: true });
  });
});
// Tombol back/forward browser
window.addEventListener('popstate', () => pilihTab(tabDariUrl() ?? 'tx', { riwayat: null }));

/* ---------- 4. Catatan Pengeluaran Harian ---------- */
const KATEGORI_TX = ['Makan & minum', 'Transportasi', 'Belanja', 'Tagihan', 'Pendidikan', 'Hiburan', 'Gaji', 'Lainnya'];

const tx = {
  data: daftar(store.get(KEY.tx, [])),
  filter: { q: '', tipe: 'semua', kat: 'semua', urut: 'terbaru' },
};
const simpanTx = () => store.set(KEY.tx, tx.data);

const txRules = {
  judul: (v) => (!v ? 'Judul wajib diisi.' : v.length > 60 ? 'Maksimal 60 karakter.' : ''),
  kategori: (v) => (v ? '' : 'Pilih kategori.'),
  jumlah: (v) => {
    if (!v) return 'Jumlah wajib diisi dengan angka.';
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? '' : 'Jumlah harus angka lebih dari 0.';
  },
  tipe: (v) => (v ? '' : 'Pilih tipe.'),
  tanggal: (v) => (v ? '' : 'Tanggal wajib diisi.'),
};

function txFields(v = {}) {
  return (
    field('Judul', 'judul', `<input name="judul" maxlength="60" autocomplete="off" value="${esc(v.judul || '')}">`) +
    field('Kategori', 'kategori', `<select name="kategori">${opsi(KATEGORI_TX, v.kategori, 'Pilih kategori')}</select>`) +
    field('Jumlah (Rp)', 'jumlah', `<input name="jumlah" type="number" min="0" step="any" inputmode="decimal" value="${v.jumlah ?? ''}">`) +
    field('Tipe', 'tipe', `<select name="tipe">${opsi(['Pengeluaran', 'Pemasukan'], v.tipe || 'Pengeluaran')}</select>`) +
    field('Tanggal', 'tanggal', `<input name="tanggal" type="date" value="${v.tanggal || hariIni()}">`)
  );
}
const bacaTx = (f) => ({
  judul: f.elements.judul.value.trim(),
  kategori: f.elements.kategori.value,
  jumlah: Number(f.elements.jumlah.value),
  tipe: f.elements.tipe.value,
  tanggal: f.elements.tanggal.value,
});

const urutTx = {
  terbaru: (a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat - a.dibuat,
  terlama: (a, b) => a.tanggal.localeCompare(b.tanggal) || a.dibuat - b.dibuat,
  besar: (a, b) => b.jumlah - a.jumlah,
  kecil: (a, b) => a.jumlah - b.jumlah,
};

function renderTx() {
  // Ringkasan dihitung dari seluruh transaksi (tidak terpengaruh filter)
  const masuk = tx.data.filter((t) => t.tipe === 'Pemasukan').reduce((s, t) => s + t.jumlah, 0);
  const keluar = tx.data.filter((t) => t.tipe === 'Pengeluaran').reduce((s, t) => s + t.jumlah, 0);
  $('#sum-in').textContent = rupiah(masuk);
  $('#sum-out').textContent = rupiah(keluar);
  $('#sum-bal').textContent = rupiah(masuk - keluar);

  const { q, tipe, kat, urut } = tx.filter;
  const hasil = tx.data
    .filter((t) => (tipe === 'semua' || t.tipe === tipe) && (kat === 'semua' || t.kategori === kat))
    .filter((t) => t.judul.toLowerCase().includes(q.toLowerCase()))
    .sort(urutTx[urut]);

  const ul = $('#list-tx');
  if (!tx.data.length) {
    ul.innerHTML = '<li class="empty"><strong>Belum ada transaksi</strong>Isi formulir di samping untuk mencatat transaksi pertama.</li>';
    return;
  }
  if (!hasil.length) {
    ul.innerHTML = '<li class="empty"><strong>Tidak ada hasil</strong>Ubah kata kunci atau filter untuk melihat transaksi lain.</li>';
    return;
  }
  ul.innerHTML = hasil.map((t) => {
    const kelas = t.tipe === 'Pemasukan' ? 'in' : 'out';
    return `<li class="item">
      <div>
        <h3>${esc(t.judul)}</h3>
        <div class="meta"><span class="badge ${kelas}">${t.tipe}</span><span class="badge">${esc(t.kategori)}</span><span>${tglIndo(t.tanggal)}</span></div>
      </div>
      <div class="side">
        <span class="amt ${kelas}">${kelas === 'in' ? '+' : '−'}${rupiah(t.jumlah)}</span>
        <div class="row">
          <button class="btn ghost sm" data-aksi="ubah" data-id="${t.id}" aria-label="Ubah ${esc(t.judul)}">Ubah</button>
          <button class="btn ghost sm" data-aksi="hapus" data-id="${t.id}" aria-label="Hapus ${esc(t.judul)}">Hapus</button>
        </div>
      </div>
    </li>`;
  }).join('');
}

function initTx() {
  const form = $('#form-tx');
  const reset = () => { form.innerHTML = txFields() + '<button class="btn primary">Tambah transaksi</button>'; };
  reset();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validasi(form, txRules)) return;
    tx.data.push({ id: uid(), dibuat: Date.now(), ...bacaTx(form) });
    simpanTx();
    renderTx();
    reset();
    toast('Transaksi ditambahkan.');
  });

  // Isi opsi filter kategori
  $('#tx-kat').innerHTML = '<option value="semua">Semua kategori</option>' + opsi(KATEGORI_TX);
  const bind = (id, kunci, evt) => $(id).addEventListener(evt, (e) => { tx.filter[kunci] = e.target.value; renderTx(); });
  bind('#tx-q', 'q', 'input');
  bind('#tx-tipe', 'tipe', 'change');
  bind('#tx-kat', 'kat', 'change');
  bind('#tx-urut', 'urut', 'change');

  // Delegasi event untuk tombol Ubah / Hapus
  $('#list-tx').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-aksi]');
    if (!btn) return;
    const item = tx.data.find((t) => t.id === btn.dataset.id);
    if (!item) return;

    if (btn.dataset.aksi === 'ubah') {
      modal.buka({
        judul: 'Ubah transaksi',
        isi: txFields(item),
        onSubmit: (f) => {
          if (!validasi(f, txRules)) return false;
          Object.assign(item, bacaTx(f));
          simpanTx(); renderTx(); toast('Transaksi diperbarui.');
        },
      });
    } else {
      modal.buka({
        judul: 'Hapus transaksi?',
        isi: `<p>Transaksi <strong>${esc(item.judul)}</strong> (${rupiah(item.jumlah)}) akan dihapus permanen.</p>`,
        tombol: 'Hapus', bahaya: true,
        onSubmit: () => {
          tx.data = tx.data.filter((t) => t.id !== item.id);
          simpanTx(); renderTx(); toast('Transaksi dihapus.');
        },
      });
    }
  });
  renderTx();
}

/* ---------- 5. Bookmark / Link Manager ---------- */
const bm = {
  data: daftar(store.get(KEY.bm, [])),
  filter: { q: '', urut: 'terbaru' },
};
const simpanBm = () => store.set(KEY.bm, bm.data);

// URL wajib diawali http:// atau https:// dan bisa di-parse oleh URL()
function urlValid(v) {
  if (!/^https?:\/\/\S+$/i.test(v)) return false;
  try { return Boolean(new URL(v).hostname.includes('.') || new URL(v).hostname === 'localhost'); } catch { return false; }
}
const bmRules = {
  nama: (v) => (!v ? 'Nama wajib diisi.' : v.length > 60 ? 'Maksimal 60 karakter.' : ''),
  url: (v) => (!v ? 'URL wajib diisi.' : urlValid(v) ? '' : 'URL harus diawali http:// atau https:// dan berupa alamat yang valid.'),
  kategori: (v) => (!v ? 'Kategori wajib diisi.' : v.length > 30 ? 'Maksimal 30 karakter.' : ''),
  catatan: (v) => (v.length > 140 ? 'Maksimal 140 karakter.' : ''),
};

function bmFields(v = {}) {
  return (
    field('Nama', 'nama', `<input name="nama" maxlength="60" autocomplete="off" value="${esc(v.nama || '')}">`) +
    field('URL', 'url', `<input name="url" type="url" inputmode="url" placeholder="https://…" value="${esc(v.url || '')}">`) +
    field('Kategori / tag', 'kategori', `<input name="kategori" maxlength="30" autocomplete="off" value="${esc(v.kategori || '')}">`) +
    field('Catatan (opsional)', 'catatan', `<textarea name="catatan" rows="2" maxlength="140">${esc(v.catatan || '')}</textarea>`)
  );
}
const bacaBm = (f) => ({
  nama: f.elements.nama.value.trim(),
  url: f.elements.url.value.trim(),
  kategori: f.elements.kategori.value.trim(),
  catatan: f.elements.catatan.value.trim(),
});

const urutBm = {
  terbaru: (a, b) => b.dibuat - a.dibuat,
  az: (a, b) => a.nama.localeCompare(b.nama, 'id'),
  za: (a, b) => b.nama.localeCompare(a.nama, 'id'),
};

function renderBm() {
  const q = bm.filter.q.toLowerCase();
  const hasil = bm.data
    .filter((b) => [b.nama, b.url, b.kategori].some((s) => s.toLowerCase().includes(q)))
    .sort(urutBm[bm.filter.urut]);

  const ul = $('#list-bm');
  if (!bm.data.length) {
    ul.innerHTML = '<li class="empty"><strong>Belum ada tautan</strong>Simpan situs favorit Anda lewat formulir di samping.</li>';
    return;
  }
  if (!hasil.length) {
    ul.innerHTML = '<li class="empty"><strong>Tidak ada hasil</strong>Coba kata kunci lain.</li>';
    return;
  }
  ul.innerHTML = hasil.map((b) => `<li class="item">
      <div>
        <h3><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.nama)}</a></h3>
        <a class="url" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.url)}</a>
        <div class="meta"><span class="badge">${esc(b.kategori)}</span></div>
        ${b.catatan ? `<p class="note">${esc(b.catatan)}</p>` : ''}
      </div>
      <div class="side"><div class="row">
        <button class="btn ghost sm" data-aksi="ubah" data-id="${b.id}" aria-label="Ubah ${esc(b.nama)}">Ubah</button>
        <button class="btn ghost sm" data-aksi="hapus" data-id="${b.id}" aria-label="Hapus ${esc(b.nama)}">Hapus</button>
      </div></div>
    </li>`).join('');
}

function initBm() {
  const form = $('#form-bm');
  const reset = () => { form.innerHTML = bmFields() + '<button class="btn primary">Simpan tautan</button>'; };
  reset();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validasi(form, bmRules)) return;
    bm.data.push({ id: uid(), dibuat: Date.now(), ...bacaBm(form) });
    simpanBm(); renderBm(); reset(); toast('Tautan disimpan.');
  });

  $('#bm-q').addEventListener('input', (e) => { bm.filter.q = e.target.value; renderBm(); });
  $('#bm-urut').addEventListener('change', (e) => { bm.filter.urut = e.target.value; renderBm(); });

  $('#list-bm').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-aksi]');
    if (!btn) return;
    const item = bm.data.find((b) => b.id === btn.dataset.id);
    if (!item) return;

    if (btn.dataset.aksi === 'ubah') {
      modal.buka({
        judul: 'Ubah tautan',
        isi: bmFields(item),
        onSubmit: (f) => {
          if (!validasi(f, bmRules)) return false;
          Object.assign(item, bacaBm(f));
          simpanBm(); renderBm(); toast('Tautan diperbarui.');
        },
      });
    } else {
      modal.buka({
        judul: 'Hapus tautan?',
        isi: `<p>Tautan <strong>${esc(item.nama)}</strong> akan dihapus permanen.</p>`,
        tombol: 'Hapus', bahaya: true,
        onSubmit: () => {
          bm.data = bm.data.filter((b) => b.id !== item.id);
          simpanBm(); renderBm(); toast('Tautan dihapus.');
        },
      });
    }
  });
  renderBm();
}

/* ---------- 6. Kuis Interaktif ---------- */
// Bank soal: array of object. `benar` = indeks opsi yang tepat
const SOAL = [
  { tanya: 'Elemen HTML5 mana yang menandai konten utama unik sebuah halaman?',
    opsi: ['<article>', '<div>', '<main>', '<section>'], benar: 2,
    info: '<main> hanya dipakai sekali per halaman untuk konten utama.' },
  { tanya: 'Method DOM apa yang mengambil elemen pertama yang cocok dengan selector CSS?',
    opsi: ['querySelector()', 'getElementsByTag()', 'selectAll()', 'findElement()'], benar: 0,
    info: 'querySelector() menerima selector CSS dan mengembalikan elemen pertama yang cocok.' },
  { tanya: 'Apa hasil dari typeof null di JavaScript?',
    opsi: ['"null"', '"undefined"', '"number"', '"object"'], benar: 3,
    info: 'Ini perilaku bawaan sejak awal JavaScript dan dipertahankan demi kompatibilitas.' },
  { tanya: 'Method array mana yang menghasilkan array baru berisi elemen yang memenuhi syarat?',
    opsi: ['map()', 'filter()', 'push()', 'find()'], benar: 1,
    info: 'filter() menyaring elemen berdasarkan fungsi kondisi.' },
  { tanya: 'Objek harus diubah menjadi apa sebelum disimpan ke localStorage?',
    opsi: ['Angka', 'Array kosong', 'String JSON', 'Node DOM'], benar: 2,
    info: 'localStorage hanya menyimpan string, jadi gunakan JSON.stringify().' },
  { tanya: 'Properti CSS mana yang mengaktifkan tata letak berbasis kolom dan baris?',
    opsi: ['display: grid', 'position: fixed', 'float: grid', 'layout: table'], benar: 0,
    info: 'display: grid membuat grid container dua dimensi.' },
  { tanya: 'Nilai rel apa yang disarankan untuk tautan dengan target="_blank"?',
    opsi: ['nofollow saja', 'external', 'noopener noreferrer', 'newtab'], benar: 2,
    info: 'noopener mencegah halaman baru mengakses window.opener.' },
  { tanya: 'Apa hasil ekspresi "5" + 3 di JavaScript?',
    opsi: ['8', '"53"', 'NaN', 'Error'], benar: 1,
    info: 'Operator + menggabungkan string bila salah satu operan berupa string.' },
];

const kuis = { urutan: [], i: 0, skor: 0, terjawab: false };
const panggung = $('#kuis-stage');

const acak = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Setelah render, fokuskan judul agar pengguna pembaca layar tahu konteksnya
const fokusJudul = () => { const h = $('h2', panggung); h.tabIndex = -1; h.focus(); };

function kuisIntro(fokus = false) {
  const hs = store.get(KEY.skor, null);
  panggung.innerHTML = `
    <h2>Kuis dasar pengembangan web</h2>
    <p>${SOAL.length} soal pilihan ganda tentang HTML, CSS, dan JavaScript. Urutan soal diacak setiap kali main.</p>
    <p class="hs">${hs ? `Skor tertinggi: ${hs.skor} / ${hs.total}` : 'Belum ada skor tertinggi'}</p>
    <div><button class="btn primary" data-kuis="mulai">Mulai kuis</button></div>`;
  if (fokus) fokusJudul();
}

function kuisMulai() {
  Object.assign(kuis, { urutan: acak(SOAL.keys()), i: 0, skor: 0, terjawab: false });
  kuisSoal();
}

function kuisSoal() {
  const s = SOAL[kuis.urutan[kuis.i]];
  kuis.terjawab = false;
  panggung.innerHTML = `
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${SOAL.length}" aria-valuenow="${kuis.i + 1}"><i style="width:${((kuis.i + 1) / SOAL.length) * 100}%"></i></div>
    <p class="note">Soal ${kuis.i + 1} dari ${SOAL.length} · Skor ${kuis.skor}</p>
    <h2>${esc(s.tanya)}</h2>
    <div class="opts">${s.opsi.map((o, n) => `<button class="opt" data-pilih="${n}">${esc(o)}</button>`).join('')}</div>
    <div id="kuis-aksi"></div>`;
  fokusJudul();
}

function kuisJawab(n) {
  if (kuis.terjawab) return;
  kuis.terjawab = true;
  const s = SOAL[kuis.urutan[kuis.i]];
  const benar = n === s.benar;
  if (benar) kuis.skor++;

  $$('.opt', panggung).forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === s.benar) btn.classList.add('ok');
    else if (idx === n) btn.classList.add('no');
  });
  const terakhir = kuis.i === SOAL.length - 1;
  $('#kuis-aksi').innerHTML = `
    <p class="fb" role="status">${benar ? 'Benar!' : `Kurang tepat. Jawaban yang benar: ${esc(s.opsi[s.benar])}.`} ${esc(s.info)}</p>
    <button class="btn primary" data-kuis="lanjut">${terakhir ? 'Lihat hasil' : 'Soal berikutnya'}</button>`;
  $('[data-kuis="lanjut"]', panggung).focus();
}

function kuisHasil() {
  const total = SOAL.length;
  const lama = store.get(KEY.skor, null);
  const rekorBaru = !lama || kuis.skor > lama.skor;
  if (rekorBaru) store.set(KEY.skor, { skor: kuis.skor, total, tanggal: hariIni() });

  const persen = kuis.skor / total;
  const komentar = persen === 1 ? 'Sempurna!' : persen >= 0.7 ? 'Bagus, pemahaman Anda sudah kuat.' : persen >= 0.4 ? 'Cukup baik, masih ada yang bisa diperdalam.' : 'Pelajari materinya lagi, lalu coba kembali.';
  panggung.innerHTML = `
    <h2>Hasil kuis</h2>
    <p class="big">${kuis.skor} / ${total}</p>
    <p>${komentar}</p>
    <p class="hs">${rekorBaru ? 'Skor tertinggi baru!' : `Skor tertinggi: ${lama.skor} / ${lama.total}`}</p>
    <div class="row"><button class="btn primary" data-kuis="mulai">Ulangi kuis</button><button class="btn ghost" data-kuis="intro">Kembali</button></div>`;
  fokusJudul();
}

function initKuis() {
  panggung.addEventListener('click', (e) => {
    const pilih = e.target.closest('[data-pilih]');
    if (pilih) return kuisJawab(Number(pilih.dataset.pilih));
    const aksi = e.target.closest('[data-kuis]')?.dataset.kuis;
    if (aksi === 'mulai') kuisMulai();
    else if (aksi === 'intro') kuisIntro(true);
    else if (aksi === 'lanjut') {
      if (kuis.i === SOAL.length - 1) kuisHasil();
      else { kuis.i++; kuisSoal(); }
    }
  });
  kuisIntro();
}

/* ---------- Inisialisasi ---------- */
initTx();
initBm();
initKuis();
// Path URL diutamakan; jika tidak cocok, pulihkan tab terakhir dari localStorage
pilihTab(tabDariUrl() ?? store.get(KEY.tab, 'tx'), { riwayat: null });
