# LinguaFlow — *Learn languages while watching.*

Extension Firefox (Manifest V3) biến phụ đề Netflix thành công cụ học ngôn ngữ: **bấm vào một từ trên phụ đề** để xem nghĩa, phân tích hình thái (gốc từ + trợ từ + đuôi), phát âm, lưu từ và ôn tập bằng thẻ ghi nhớ (spaced repetition).

**V1 = tiếng Hàn trước tiên**, nhưng kiến trúc là *Core → Language Pack → Korean*: toàn bộ phần lõi không biết gì về tiếng Hàn, nên thêm tiếng Nhật/Trung/Anh… chỉ là viết thêm một language pack (xem [Cách thêm language pack mới](#cách-thêm-language-pack-mới-ví-dụ-japanese)).

- **100 % cục bộ**: không tài khoản, không analytics, không theo dõi, không tải phụ đề/từ vựng lên đâu cả. Từ vựng nằm trong `browser.storage.local`. Có test tự động kiểm tra điều này (xem [Quyền riêng tư](#quyền-riêng-tư)).
- **Chạy cùng NflxMultiSubs 2021**: LinguaFlow *không vẽ phụ đề thứ hai chồng lên*; nó chỉ đọc chữ đã được Netflix/NflxMultiSubs hiển thị rồi thêm vùng bấm, từ điển, hình thái, lưu từ, phát âm.
- Không đụng tới DRM, giải mã video, tài khoản hay xác thực Netflix. Việc duy nhất liên quan tới player là **tạm dừng/phát lại phần tử `<video>`** khi bạn mở/đóng thẻ từ (tắt được trong Settings).

---

## 1. Cài trên Firefox (Linux)

Cần Firefox **≥ 140** (do khai báo `data_collection_permissions: none`).

1. Giải nén `linguaflow-1.0.0.zip` (hoặc dùng thẳng file zip).
2. Mở `about:debugging#/runtime/this-firefox` → **This Firefox** → **Load Temporary Add-on…** → chọn `manifest.json` (hoặc file `.zip`).
3. Mở Netflix. Biểu tượng LinguaFlow xuất hiện trên thanh công cụ.

> **Add-on tạm thời sẽ biến mất khi tắt Firefox** — đây là cơ chế của Firefox cho add-on chưa ký. Để dùng lâu dài:
> - **Firefox Developer Edition / Nightly / ESR**: vào `about:config` đặt `xpinstall.signatures.required = false`, rồi `about:addons` → bánh răng → *Install Add-on From File…* → chọn file `.zip`; hoặc
> - **Ký miễn phí ở chế độ “unlisted” (tự phân phối)** trên addons.mozilla.org bằng `npx web-ext sign --channel=unlisted …` (cần tài khoản AMO của *bạn*; bản thân extension không cần tài khoản nào).

**Nếu extension không chạy trên Netflix:** Firefox MV3 có thể chưa cấp quyền site. Vào `about:addons` → LinguaFlow → tab **Permissions** → bật *Access your data for www.netflix.com*. Phím tắt `Alt+Shift+L` (bật/tắt chế độ học) đổi được ở `about:addons` → bánh răng → *Manage Extension Shortcuts*.

### Phát âm (🔊) trên Linux
Phát âm dùng Web Speech API của trình duyệt, tức là **giọng đọc của hệ điều hành**. Trên Linux, Firefox lấy giọng từ `speech-dispatcher`:

```bash
sudo apt install speech-dispatcher speech-dispatcher-espeak-ng espeak-ng   # Debian/Ubuntu
spd-say -l ko "안녕하세요"                                                  # thử: có tiếng là ổn
```
Khởi động lại Firefox; kiểm tra `about:config` → `media.webspeech.synth.enabled = true`. Giọng `espeak-ng` tiếng Hàn khá máy móc; nếu bạn có giọng ko-KR tốt hơn (speech-dispatcher + module khác) Firefox sẽ dùng giọng đó. **Nếu không có giọng ko-KR, LinguaFlow báo rõ lý do trong thẻ từ thay vì đọc tiếng Hàn bằng giọng tiếng Anh.**

---

## 2. Cách dùng với Netflix + NflxMultiSubs

1. Cài/bật NflxMultiSubs. Trong menu phụ đề của Netflix chọn **한국어**; trong NflxMultiSubs chọn **Tiếng Việt** làm phụ đề thứ hai (hoặc ngược lại — LinguaFlow tự nhận ra dòng nào là tiếng Hàn theo chữ Hangul).
2. Mở một tập phim. **Rê chuột** lên một từ tiếng Hàn: từ đó được tô sáng.
3. **Bấm** vào từ → thẻ từ hiện ngay phía trên dòng phụ đề (không che phụ đề; dòng dịch vẫn đọc được). Video tạm dừng.
4. Trong thẻ:

```
┌───────────────────────────────┐
│ 어디에                  🔊  ✕ │   🔊 nghe phát âm
│ eodie                         │   phiên âm La-tinh (Revised Romanization)
│ ───────────────────────────── │
│ 어디   = đâu                  │   từng hình vị, tô màu theo vai trò
│ -에    = ở / tại / vào lúc    │
│ → ở đâu                       │   nghĩa ghép
│ ▸ Câu gốc & bản dịch          │   câu tiếng Hàn + dòng dịch
│ [＋ Lưu từ]  [Đã biết]        │
└───────────────────────────────┘
```
5. **Lưu từ** → từ vào danh sách ôn tập (đến hạn ngay). **Đã biết** → lưu nhưng loại khỏi ôn tập. Bấm lại để bỏ.
6. **Esc** hoặc ✕ đóng thẻ và phát lại video (chỉ khi chính LinguaFlow đã tạm dừng nó). Bấm ra ngoài thẻ cũng đóng thẻ (lúc đó bạn tự điều khiển video).
7. Popup (biểu tượng trên thanh công cụ): chọn ngôn ngữ, bật/tắt từng tính năng, xem **Vocabulary**, làm **Review** (Again/Hard/Good/Easy, phím `Space` rồi `1–4`), **Settings**. Nút ⤢ mở trang đầy đủ.

### Với *Gyeongseong Creature* (경성크리처)
Mở phim, bật phụ đề 한국어 trong Netflix, (tùy chọn) phụ đề tiếng Việt qua NflxMultiSubs. Từ điển khởi đầu đã có sẵn từ vựng bối cảnh phim: 경성, 조선, 일본군, 총독부, 전당포, 병원, 실험, 괴물, 크리처, 탈출, 비밀, 목숨, 복수, 배신, 살려주세요… Từ chưa có trong từ điển sẽ được **ghi rõ là “chưa có trong từ điển cục bộ”** (và vẫn được phân tích ngữ pháp nếu đủ bằng chứng) — xem [mở rộng từ điển](#mở-rộng-từ-điển).

---

## 3. Phân tích tiếng Hàn: cách hoạt động và độ tin cậy

`src/languages/korean/` gồm: `tokenizer.js` (tách theo loại ký tự: Hangul / số / Latin / jamo / dấu câu — `있었어요?` → `있었어요` + `?`, giữ nguyên offset để ánh xạ ngược lên DOM), `morphology.js`, `particles.js` (53 trợ từ, xếp chồng được: `에서는`, `에게도`, `사람들이`), `endings.js` (98 đuôi: 78 đuôi gốc + 20 biến thể `-요`; cộng 28 dạng của `이다`), `conjugation.js`, `dictionary.js`, `romanization.js`, `hangul.js`, `index.js`.

**Nguyên tắc “không cố tình phân tích sai”.** Bộ phân tích đề xuất các cách đọc ứng viên (gốc từ + tiền tố cuối + đuôi / danh từ + trợ từ / danh từ + 이다 / V-아/어 + trợ động từ …) rồi **chỉ giữ cách đọc nào *sinh lại đúng nguyên văn* từ phía động từ hóa tiến** (`conjugation.js` xử lý bất quy tắc ㅂ ㄷ ㅅ ㅎ 르, lược ㅡ, lược ㄹ, 하다, 되다, 아니다, 드시다/계시다…). Hệ quả:

| Trường hợp | LinguaFlow làm gì |
|---|---|
| Gốc từ có trong từ điển + đuôi khớp | `Analysis confidence: high` |
| Một dạng có nhiều cách đọc hợp lệ (`사는` = 살다/사다, `걸어요` = 걷다/걸다) | Hạ độ tin cậy, đánh dấu *ambiguous*, liệt kê **cách phân tích khác** |
| Gốc từ **không** có trong từ điển | Giải thích ngữ pháp nhưng **không bịa nghĩa**; `Analysis confidence: low`, ghi “chưa có trong từ điển cục bộ” |
| Không phân tích được | Hiện nguyên từ, độ tin cậy thấp |

Khi độ tin cậy không cao, thẻ có nút **Xem từ gốc** (từ nguyên văn trên phụ đề, dạng từ điển, các cách đọc khác).

Ví dụ thật từ bộ test: `먹었습니다` → `먹다 = ăn` · `먹었- = đã ăn` · `-습니다 = đuôi câu lịch sự, trang trọng` → *đã ăn (lịch sự, trang trọng)*; `사람이` → `사람` + `-이` → *người (chủ ngữ)*; `한국어를` → *tiếng Hàn (tân ngữ)*; `추워요` → 춥다 (ㅂ bất quy tắc); `도와주세요` → 돕다 + 주다 (*xin hãy giúp tôi*).

### Giới hạn đã biết (nói thẳng)
- Phân tích theo **từng 어절**; cấu trúc trải qua nhiều từ (`-고 있다`, `-ㄹ 수 있다`, `-아/어 주세요` viết cách) chưa được nối lại. Các trợ động từ viết liền (`먹어봐요`, `도와주세요`, `가고싶어요`) thì có.
- Chưa dùng ngữ cảnh câu để chọn giữa các cách đọc đồng âm — thay vào đó **báo là mơ hồ**.
- Phiên âm: có liên âm, biến âm (cuối âm tiết, mũi hóa, âm bên, bật hơi, vòm hóa, căng hóa trong từ), chưa có ㄴ-thêm trong từ ghép và ngoại lệ Hán-Hàn.
- Từ điển khởi đầu chỉ có **1 374 mục** (xem dưới) — đủ cho hội thoại thường gặp, không thay thế từ điển đầy đủ.
- Phụ đề dạng **hình ảnh** (bitmap) không có chữ để đọc → không thể bấm.

---

## 4. Từ điển và cách mở rộng

`data/korean/dictionary.json` (biên dịch từ `dictionary.src.txt`) là bộ từ vựng **tự biên soạn**, nghĩa tiếng Việt, **không** dùng API trả phí, không cần tài khoản, không gọi mạng. Cấu trúc kiến trúc tách rời: `DictionaryManager.lookup(word, language)` → `DictionaryProvider` → `LocalProvider`; core không biết đó là từ điển Hàn.

### Mở rộng từ điển
Sửa `data/korean/dictionary.src.txt` (mỗi dòng `từ|loại từ|nghĩa 1; nghĩa 2|cờ bất quy tắc (tùy chọn)`), thứ tự ≈ độ thường gặp, rồi:

```bash
npm run dict        # biên dịch lại dictionary.json
npm test            # test kiểm tra từ điển còn đồng bộ và mọi động từ vẫn “khứ hồi” được
```
Loại từ: `n pron num cnt nbound det adv int conj v adj aux cop phrase`. Động từ/tính từ ghi ở dạng từ điển (`먹다`); cờ `ㅂ ㄷ ㅅ ㅎ 르 reg` chỉ cần khi quy tắc tự động đoán sai. Muốn dùng nguồn khác (ví dụ KRDict, Wiktionary): viết thêm một `DictionaryProvider` và đăng ký bằng `LF.dictionaries.register('ko', provider)` — *chú ý giấy phép của dữ liệu*.

---

## 5. Kiến trúc

```
LinguaFlow
├── Core  (không biết gì về ngôn ngữ cụ thể)
│   ├── subtitle/     SubtitleManager ─ NflxMultiSubsAdapter / NetflixAdapter ─ SubtitleParser
│   ├── dictionary/   DictionaryManager → DictionaryProvider → LocalProvider
│   ├── vocabulary/   VocabularyManager + VocabularyStorage (mỗi từ lưu `language`)
│   ├── review/       ReviewEngine (lặp lại ngắt quãng kiểu SM-2)
│   ├── pronunciation/ Pronunciation.speak(text, language)  (Web Speech API)
│   ├── language/     LanguagePack (interface) + LanguagePackManager
│   └── settings.js · i18n.js · util.js
├── Content (trang Netflix)  LearningController · LearningOverlay (Shadow DOM) · PlayerControl
├── Popup / trang đầy đủ · Background (rất nhỏ)
└── Language Packs
    └── Korean (v1)        Japanese · Chinese · English · … (Coming soon)
```

```
linguaflow/
├── manifest.json · README.md · LICENSE · build.sh · package.json
├── src/core/{subtitle,dictionary,vocabulary,review,pronunciation,language}/ · settings.js · i18n.js · util.js
├── src/languages/korean/{index,tokenizer,morphology,particles,endings,conjugation,dictionary,hangul,romanization}.js
├── src/content/{overlay.js,overlay-styles.js,learning-controller.js,content-main.js}
├── src/popup/{popup.html,page.html,popup.css,popup.js} · src/background/background.js
├── data/korean/{dictionary.json,dictionary.src.txt} · icons/ · scripts/{build-dictionary.js,check-syntax.js}
└── tests/{korean,subtitle,vocabulary,core,helpers}/
```
> `ReviewEngine` nằm ở `core/review/` (theo cây thư mục ở yêu cầu §19; §10 liệt kê nó cạnh vocabulary).

**Interface** (`src/core/language/language-pack.js`): `getId() getName() getNativeName() tokenize(text) analyzeWord(word) lookup(word) getPronunciation(word) getWordForm(word) getBaseForm(word)` + `getSpeechLang() detect(text) init()` và hai hook tùy chọn `getExtraForms()`, `getExternalLinks()`. Core chỉ gọi interface — một test tự động quét `src/core` để chắc không có nhánh `if (language === 'ko')`.

**Phát hiện phụ đề.** Một `MutationObserver` (debounce 30 ms, **không** `setInterval`, không quét toàn trang liên tục), chỉ xử lý khi chữ phụ đề *thật sự đổi* (có cache). Adapter đọc:
- NflxMultiSubs 2.2.1: phụ đề thứ hai là **một `<text>` SVG** trong `svg.nflxmultisubs-subtitle-svg` (cấu trúc lấy từ mã nguồn của nó); phụ đề chính vẫn là DOM gốc của Netflix.
- Netflix: `.player-timedtext > .player-timedtext-text-container > span` (dòng cách nhau bằng `<br>`).

`getCurrentSubtitle()` trả `{ primary:{language,text}, secondary:{language,text}, timestamp, videoTime, source }`. Dòng nào là “primary” do **language pack** quyết định (`detect()`), không phải core.

**Bấm từ không cần vẽ phụ đề.** Vị trí từng từ được tính **tại thời điểm rê/bấm** (Range cho chữ HTML, `getExtentOfChar` cho SVG), nên luôn đúng dù Netflix/NflxMultiSubs dời, phóng to hay chuyển toàn màn hình. Hộp tô sáng và thẻ từ nằm trong một Shadow DOM riêng (CSS của Netflix không lọt vào, CSS của ta không lọt ra; dùng `adoptedStyleSheets` nên sống được dưới CSP nghiêm ngặt).

### Dữ liệu từ vựng
```json
{ "id": "ko:어디", "language": "ko", "word": "어디에", "lemma": "어디", "meaning": "đâu; ở đâu",
  "sentence": "오늘 어디에 있었어요?", "translation": "Hôm nay bạn đã ở đâu?", "createdAt": 1700000000000,
  "known": false, "reviewCount": 0, "lastReviewed": null, "nextReview": 1700000000000, "interval": 0, "ease": 2.5 }
```
(+ `pos`, `pronunciation`, `forms`, `contexts`). Mỗi từ là một khóa riêng (`lf:v1:vocab:<id>`) nên popup và trang Netflix lưu cùng lúc không ghi đè nhau. Xuất/nhập JSON, xuất CSV ở tab Vocabulary.

---

## 6. Hướng dẫn gỡ lỗi khi Netflix đổi DOM

Mọi chi tiết DOM nằm ở **một** file: `src/core/subtitle/selectors.js`. Nhưng thường bạn không cần sửa mã:

1. Mở trang xem phim, nhấn **`Alt+Shift+D`** → bảng chẩn đoán (JSON): adapter nào đang hoạt động, các khối phụ đề đọc được (kèm điểm “giống tiếng Hàn”), từ nào bấm được. Nút **Copy** để gửi khi báo lỗi.
2. Nếu `blocks` rỗng dù phụ đề đang hiện → selector cũ đã hỏng. Nhấn `F12` → Inspector → công cụ chọn phần tử (`Ctrl+Shift+C`) → bấm vào chữ phụ đề → xem class của phần tử **chứa chữ** (ví dụ `.player-timedtext-text-container`).
3. Mở popup → **Settings** → *Bộ chọn phụ đề tùy chỉnh (CSS)* → dán selector (mỗi dòng một cái, `#` để ghi chú) → có hiệu lực ngay, không cần tải lại. Selector sai cú pháp bị bỏ qua, không làm hỏng gì.
4. `blocks` có nội dung nhưng `clickableWords` rỗng → dòng đó không được nhận là tiếng Hàn (điểm `score` < 0.5) hoặc chữ không phải văn bản (phụ đề hình ảnh).
5. Bật *Ghi log gỡ lỗi* trong Settings để xem tiền tố `[LinguaFlow]` ở Web Console.

---

## 7. Kiểm thử — đã kiểm chứng gì, chưa kiểm chứng gì

```bash
npm install          # chỉ để có jsdom cho test DOM (không vào gói extension)
npm test             # 111 test, ~20 giây
npm run check        # kiểm tra cú pháp toàn bộ .js/.json
npm run lint         # web-ext lint trên gói zip (cần mạng lần đầu để tải web-ext)
bash build.sh        # check + dictionary + test + đóng gói dist/*.zip
```

**Đã chạy và đạt** (trong môi trường phát triển của dự án này):
- `node scripts/check-syntax.js`: 53 tệp `.js/.json` hợp lệ.
- **111 unit test** (Node test runner + jsdom): tokenizer; 124 dạng chia động (quy tắc và bất quy tắc); 55 dạng suy ra đúng gốc từ; “khứ hồi” mọi động từ trong từ điển; phát âm/romanization; phát hiện phụ đề (Netflix gốc, NflxMultiSubs SVG, hai bố cục đảo ngược, phụ đề đổi/xóa, nút ẩn, selector tùy chỉnh, phụ đề hình ảnh); từ vựng, ôn tập, nhập/xuất; overlay; luồng bấm → thẻ → lưu → đóng/phát lại; popup/trang đầy đủ chạy từ HTML thật; kiểm toán quyền riêng tư.
- `web-ext lint` (bộ kiểm tra của Mozilla): **0 lỗi, 0 cảnh báo**.
- **Chạy thật trong engine Gecko** (Zen Browser 1.23b, headless, cài như add-on MV3 tạm thời) trên một trang “Netflix giả” có layout thật (chữ HTML + SVG `<text>` kiểu NflxMultiSubs, `<video>` đang chạy thật): **24/24 kiểm tra đạt** — content script được tiêm; hộp tô sáng khớp ô chữ ≤ 6 px; bấm chữ HTML và chữ SVG mở đúng thẻ; cú bấm không lọt tới trang; video được tạm dừng rồi `Esc` phát lại; thẻ không che dòng dịch; 🔊 báo rõ khi máy không có giọng; lưu từ rồi thấy ở trang Vocabulary; đổi cài đặt ở trang popup (tab khác) có hiệu lực ngay ở tab Netflix; thẻ vẫn đúng kiểu và từ điển vẫn nạp được khi trang có CSP chặn style inline và `connect-src 'self'`.

**Chưa kiểm chứng được (nói thẳng):**
- **Netflix thật** (cần tài khoản và nội dung có DRM) và **NflxMultiSubs thật** chạy cùng nhau. Cấu trúc DOM của chúng được dựng lại từ mã nguồn NflxMultiSubs 2.2.1 và mô tả Netflix timed text — Netflix có thể đổi bất kỳ lúc nào (xem mục 6).
- **Firefox bản chính thức**: máy build không tải được; test chạy trên Zen (nhân Gecko của Firefox). Hành vi API WebExtension giống nhau, nhưng bạn nên thử trên Firefox của mình.
- **Giọng đọc thật** (máy build không có TTS) — phần hiển thị lỗi “thiếu giọng” đã test, phần phát tiếng thật thì chưa.
- **Toàn màn hình thật trên Netflix**: logic gắn lại overlay vào phần tử fullscreen đã test bằng jsdom, chưa test trên Netflix.

---

## 8. Quyền riêng tư

- Quyền: chỉ `storage` + site `https://www.netflix.com/*`. Không `tabs`, `cookies`, `history`, `webRequest`, `<all_urls>`.
- Không `XMLHttpRequest`, `sendBeacon`, `WebSocket`, không mã từ xa, không `eval`, không `innerHTML` (mọi chữ phụ đề đi qua text node). `fetch` chỉ đọc **tệp đóng gói sẵn** trong extension (từ điển). Test `tests/core/package.test.js` quét mã nguồn để giữ các điều này.
- Nút tra từ điển online (Naver, Wiktionary) **tắt mặc định**; khi bật, chỉ mở tab mới **khi bạn bấm**.
- Manifest khai báo `data_collection_permissions: { required: ["none"] }`.

---

## Cách thêm language pack mới (ví dụ: Japanese)

*(Chỉ là hướng dẫn — **không** có tiếng Nhật trong V1.)* Core không cần sửa. Bằng chứng: `tests/core/language-pack.test.js` đăng ký một pack Nhật giả và chạy phụ đề, từ vựng, phát âm qua đúng các API của core.

**Bước 1 — tạo thư mục** `src/languages/japanese/` với `index.js` (và tùy ý `tokenizer.js`, `morphology.js`, `dictionary.js`…).

**Bước 2 — implement interface:**

```js
(function (root) {
  const LF = root.LinguaFlow;
  class JapaneseLanguagePack extends LF.LanguagePack {
    getId() { return 'ja'; }          getName() { return 'Japanese'; }     getNativeName() { return '日本語'; }
    getFlag() { return '🇯🇵'; }        getSpeechLang() { return 'ja-JP'; }  // dùng cho Pronunciation.speak
    async init() { /* nạp từ điển: đăng ký LocalProvider cho 'ja' rồi await init() */ }
    detect(text) { /* 0..1: tỉ lệ kana/kanji trong chữ cái — core dùng để tìm dòng đang học */ }
    tokenize(text) {
      // Tiếng Nhật không có dấu cách: dùng Intl.Segmenter('ja', { granularity: 'word' }) (có sẵn, offline)
      // trả về [{ text, start, end, type, clickable }]; offset phải là offset trên chuỗi gốc
    }
    analyzeWord(word) {
      // trả { surface, lemma, pos, known, confidence, confidenceLabel, display:[{text,gloss,kind}], summary, warnings, alternatives }
      // (khử chia động: ichidan/godan/する/来る, tính từ い/な) — chỉ giữ cách đọc sinh lại đúng nguyên văn, như pack Hàn
    }
    async lookup(word) { /* { word, lemma, pos, meanings[], pronunciation, examples[], confidence } */ }
    getPronunciation(word) { return { text: word, lang: 'ja-JP', romanization: /* romaji */ }; }
    getWordForm(word) { /* mô tả dạng ngữ pháp */ }
    getBaseForm(word) { return this.analyzeWord(word).lemma; }
  }
  LF.LanguagePackManager.register(new JapaneseLanguagePack());
})(globalThis);
```

**Bước 3 — dữ liệu:** `data/japanese/dictionary.json` cùng schema (`{ meta, entries: { từ: { pos, meanings[], … } } }`). Nếu lấy từ nguồn mở như JMdict, **tuân thủ giấy phép và ghi công** (JMdict: CC BY-SA 4.0).

**Bước 4 — nối vào extension** (3 chỗ, đều chỉ là danh sách tệp): thêm các tệp của pack vào `content_scripts[0].js` trong `manifest.json` *trước* `src/content/overlay-styles.js`; thêm vào danh sách `<script>` của `src/popup/popup.html` và `page.html` (trước `popup.js`); thêm `data/japanese/dictionary.json` vào `web_accessible_resources`.

**Bước 5 — xong.** `日本語` tự chuyển từ *Coming soon* sang chọn được trong popup (danh sách lấy từ `LanguagePackManager.listAll()`), `settings.language = 'ja'`, từ vựng lưu `language: "ja"`, 🔊 dùng `ja-JP`. Viết test trong `tests/japanese/` (helper `tests/helpers/load.js` nạp tệp theo đúng thứ tự manifest).

---

## Lộ trình
Tiếng Nhật/Trung/Anh/Tây Ban Nha/Pháp/Đức · nối cấu trúc nhiều 어절 · dùng ngữ cảnh để gỡ mơ hồ · Hán-Việt cho từ Hán-Hàn · từ điển lớn hơn qua provider mới · gạch chân từ đã lưu trên phụ đề · đồng bộ thủ công (tệp xuất/nhập) giữa các máy.

## Giấy phép
MIT (xem `LICENSE`). “Netflix” và “NflxMultiSubs” là tên của chủ sở hữu tương ứng; LinguaFlow độc lập, không liên kết và không chứa mã của họ.
