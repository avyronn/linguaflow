# LinguaFlow — *Learn languages while watching.*

🔗 [github.com/avyronn/linguaflow](https://github.com/avyronn/linguaflow) · [Releases](https://github.com/avyronn/linguaflow/releases) · [Issues](https://github.com/avyronn/linguaflow/issues)

🇬🇧 English: [README.en.md](README.en.md) · 🤝 Đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md) · 📜 Nguồn dữ liệu & giấy phép: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) · 📝 [CHANGELOG.md](CHANGELOG.md)

<p>Made with <img src="icons/heart.svg" width="16" height="16" alt="love" align="absmiddle"> by <a href="https://github.com/avyronn"><b>AVYRON</b></a></p>

Extension Firefox (Manifest V3) biến phụ đề Netflix thành công cụ học ngôn ngữ: **bấm vào một từ trên phụ đề** để xem nghĩa, phân tích hình thái (gốc từ + trợ từ + đuôi), Hán tự · Hán-Việt, phát âm, **mẫu ngữ pháp và cấu trúc của cả câu**, rồi lưu từ và ôn tập bằng thẻ ghi nhớ (spaced repetition).

**V1 = tiếng Hàn trước tiên**, nhưng kiến trúc là *Core → Language Pack → Korean*: toàn bộ phần lõi không biết gì về tiếng Hàn, nên thêm tiếng Nhật/Trung/Anh… chỉ là viết thêm một language pack (xem [Cách thêm language pack mới](#cách-thêm-language-pack-mới-ví-dụ-japanese)).

- **100 % cục bộ**: không tài khoản, không analytics, không theo dõi, không tải phụ đề/từ vựng lên đâu cả. Từ vựng nằm trong `browser.storage.local`. Có test tự động kiểm tra điều này (xem [Quyền riêng tư](#8-quyền-riêng-tư)).
- **Chạy cùng NflxMultiSubs 2021**: LinguaFlow *không vẽ phụ đề thứ hai chồng lên*; nó chỉ đọc chữ đã được Netflix/NflxMultiSubs hiển thị rồi thêm vùng bấm, từ điển, hình thái, ngữ pháp, lưu từ, phát âm.
- Không đụng tới DRM, giải mã video, tài khoản hay xác thực Netflix. Việc duy nhất liên quan tới player là **tạm dừng/phát lại phần tử `<video>`** khi bạn mở/đóng thẻ từ (tắt được trong Settings).
- **Nói thẳng về chất lượng:** nội dung tiếng Hàn–Việt (nghĩa, giải thích ngữ pháp, ví dụ, Hán-Việt) do dự án viết với sự hỗ trợ của AI và **chưa được người bản ngữ hay giáo viên tiếng Hàn rà soát**. Bộ test giữ cho dữ liệu *nhất quán* (xem §7) nhưng không thể chứng minh tiếng Hàn *tự nhiên*. Thấy sai? Mở issue — xem [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. Cài trên Firefox (Linux)

Cần Firefox **≥ 140** (do khai báo `data_collection_permissions: none`).

1. Giải nén `linguaflow-1.1.1.zip` (hoặc dùng thẳng file zip).
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
3. **Bấm** vào từ → thẻ từ hiện ngay phía trên dòng phụ đề (không che phụ đề; dòng dịch vẫn đọc được — thẻ tự rút ngắn và cuộn bên trong khi quá cao). Video tạm dừng.
4. Thẻ cho câu `오늘 어디에 있었어요?` khi bấm vào `어디에` (nội dung thật từ bộ phân tích; các phần đóng/mở bằng cách bấm tiêu đề):

```
┌─────────────────────────────────────────┐
│ 어디에                           🔊   ✕ │   🔊 nghe phát âm
│ eodie                                   │   phiên âm La-tinh (Revised Romanization)
│ ─────────────────────────────────────── │
│ 어디   = đâu                            │   từng hình vị, tô màu theo vai trò
│ -에    = ở / tại / vào lúc / đến        │
│ → ở đâu                                 │   nghĩa ghép
│ ▸ Câu gốc & bản dịch                    │   câu tiếng Hàn + dòng dịch
│ ▾ Mẫu ngữ pháp · 1                      │   mẫu có chứa từ bạn bấm (mở sẵn)
│     N에 있다/없다   Lv 1                 │
│     ở N / không ở N                     │
│     Trong câu: 어디에 있었어요           │
│     ▸ Giải thích & ví dụ                │
│ ▸ Các mẫu khác trong câu · 2            │   -아요/어요 · -았/었- (quá khứ)
│ ▸ Cấu trúc câu                          │   loại câu, mức lịch sự, thì, vai trò từng từ…
│ [＋ Lưu từ]  [Đã biết]                  │
└─────────────────────────────────────────┘
```

   Với từ gốc Hán, thẻ có thêm một dòng **Hán tự · Hán-Việt**, ví dụ `학교에서` → `學校 · học hiệu (trường học)`; động từ `준비해요` → `準備 · chuẩn bị (từ gốc: 준비)`.

   Mở **▸ Cấu trúc câu** cho cùng câu:

```
Câu này
  Loại câu           Câu hỏi
  Mức độ lịch sự     Lịch sự thân mật (해요체)
  Thì / thể          quá khứ
  Từ để hỏi          어디에
Vai trò từng từ
  오늘        Danh từ — hôm nay
  어디에      Địa điểm / thời điểm / đích — ở đâu
  있었어요    Vị ngữ — đã ở / có (lịch sự)
Trật tự từ     Địa điểm / thời điểm / đích → Vị ngữ
```
   Câu có mệnh đề phụ (`비가 와서 집에 있었어요.`) thêm mục **Các mệnh đề**: `비가 와서` = *mệnh đề phụ · nguyên nhân / lý do (… nên)*, `집에 있었어요` = *mệnh đề chính*.
5. **Lưu từ** → từ vào danh sách ôn tập (đến hạn ngay). **Đã biết** → lưu nhưng loại khỏi ôn tập. Bấm lại để bỏ.
6. **Esc** hoặc ✕ đóng thẻ và phát lại video (chỉ khi chính LinguaFlow đã tạm dừng nó). Bấm ra ngoài thẻ cũng đóng thẻ (lúc đó bạn tự điều khiển video).
7. Popup (biểu tượng trên thanh công cụ) có 5 tab: **Home** (chọn ngôn ngữ, bật/tắt từng tính năng — Learning mode, Click words, Morphology, **Grammar**, Vocabulary, Pronunciation), **Vocabulary**, **Review** (Again/Hard/Good/Easy, phím `Space` rồi `1–4`), **Grammar** (tra cứu ngữ pháp, xem §3.4) và **Settings**. Nút ⤢ mở trang đầy đủ. Tắt công tắc *Grammar* nếu bạn chỉ muốn nghĩa + hình thái (thẻ gọn hơn).

### Với *Gyeongseong Creature* (경성크리처)
Mở phim, bật phụ đề 한국어 trong Netflix, (tùy chọn) phụ đề tiếng Việt qua NflxMultiSubs. Từ điển có sẵn từ vựng bối cảnh phim: 경성, 조선, 일본군, 총독부, 전당포, 병원, 실험, 괴물, 크리처, 탈출, 비밀, 목숨, 복수, 배신, 살려주세요… Từ chưa có (ví dụ tên riêng nhân vật) sẽ được **ghi rõ là “chưa có trong từ điển cục bộ”** (và vẫn được phân tích ngữ pháp nếu đủ bằng chứng) — xem [mở rộng từ điển](#mở-rộng-từ-điển).

---

## 3. Tiếng Hàn: cách hoạt động, độ bao phủ và độ tin cậy

`src/languages/korean/` gồm (số liệu lấy trực tiếp từ mã, kiểm lại bằng test):

| Tệp | Làm gì |
|---|---|
| `tokenizer.js` | tách theo loại ký tự (Hangul / số / Latin / jamo / dấu câu): `있었어요?` → `있었어요` + `?`, giữ offset để ánh xạ ngược lên DOM |
| `morphology.js` | bộ phân tích hình thái: gốc từ + tiền tố cuối + đuôi / danh từ + trợ từ / danh từ + 이다 / V-아/어 + trợ động từ viết liền…; 64 dạng rút gọn khi nói (`우린`, `뭘`, `이건`…), 42 trợ động từ (`먹어봐요`, `가고싶어요`) |
| `particles.js` | **95 mục trợ từ / hậu tố / dạng rút gọn** (73 trợ từ khác nhau), xếp chồng được: `에서는`, `에게도`, `사람들이`, `선생님께서는` |
| `endings.js` | **341 đuôi** (197 cuối câu · 123 liên kết · 19 định ngữ · 2 danh từ hóa; 115 có biến thể `-요`) + 138 dạng của `이다` + 13 tổ hợp tiền tố cuối |
| `conjugation.js` | chia động từ tiến (bất quy tắc ㅂ ㄷ ㅅ ㅎ 르, lược ㅡ, lược ㄹ, 하다, 되다, 아니다, 드시다/계시다…) |
| `numerals.js` | đọc số viết liền (`삼십오`, `이천이십사`, `열두`, `스물세`) và số + đơn vị (`열두시`, `삼십오분`) |
| `honorifics.js` | từ vựng kính ngữ / khiêm nhường thay thế từ thường (`드시다` = kính ngữ của `먹다`) |
| `patterns.js` + `grammar-patterns.js` | bộ khớp mẫu ngữ pháp (문형) + **danh mục 242 mẫu** |
| `grammar-guide.js` | 18 chủ đề về cấu trúc câu, 49 ví dụ |
| `sentence.js` + `grammar-view.js` | phân tích cả câu (loại câu, mức lịch sự, thì, vai trò từng từ, mệnh đề, trật tự) và trình bày cho thẻ + tab Grammar |
| `dictionary.js`, `romanization.js`, `hangul.js`, `index.js` | bộ tra từ, phiên âm, tiện ích Hangul, language pack |

### 3.1 Hình thái học — từng từ

**Nguyên tắc “không cố tình phân tích sai”.** Bộ phân tích đề xuất các cách đọc ứng viên rồi **chỉ giữ cách đọc nào *sinh lại đúng nguyên văn* từ phía động từ hóa tiến** (`conjugation.js`). Hệ quả:

| Trường hợp | LinguaFlow làm gì |
|---|---|
| Gốc từ có trong từ điển + đuôi khớp | `Analysis confidence: high` |
| Một dạng có nhiều cách đọc hợp lệ (`사는` = 살다/사다, `걸어요` = 걷다/걸다) | Hạ độ tin cậy, đánh dấu *ambiguous*, liệt kê **cách phân tích khác** |
| Nhiều từ viết liền, viết tắt, sai chính tả thường gặp (`할거야`, `할께요`) | Vẫn phân tích nhưng đánh dấu độ tin cậy trung bình và nói rõ đó là ước đoán |
| Gốc từ **không** có trong từ điển | Giải thích ngữ pháp nhưng **không bịa nghĩa**; `Analysis confidence: low`, ghi “chưa có trong từ điển cục bộ” |
| Không phân tích được | Hiện nguyên từ, độ tin cậy thấp |

Khi độ tin cậy không cao, thẻ có nút **Xem từ gốc** (từ nguyên văn trên phụ đề, dạng từ điển, các cách đọc khác).

Ví dụ thật từ bộ test: `먹었습니다` → `먹다 = ăn` · `먹었- = đã ăn` · `-습니다 = đuôi câu lịch sự, trang trọng`; `사람이` → `사람` + `-이` → *người (chủ ngữ)*; `추워요` → 춥다 (ㅂ bất quy tắc); `도와주세요` → 돕다 + 주다 (*xin hãy giúp tôi*); `우린` → 우리 + 는.

### 3.2 Mẫu ngữ pháp (문형)

Danh mục gồm **242 mục** (189 cấu trúc nhiều từ như `V-고 싶다`, `V-(으)ㄹ 수 있다`, `N 때문에` + 53 đuôi đơn như `-(으)니까`), **509 câu ví dụ**, chia **25 nhóm** (động từ phụ, khả năng/bắt buộc, phủ định, thì, thời gian, ý định, phỏng đoán, nguyên nhân, điều kiện, yêu cầu, đối lập, mục đích, trích dẫn, danh từ hóa, mức độ, so sánh, cụm trợ từ, tồn tại, cảm xúc, khẩu ngữ, câu hỏi, kính ngữ, …). Mức **Lv 1–6** (37 · 56 · 67 · 62 · 19 · 1 mục) là ước lượng *kiểu TOPIK do dự án tự gán*, không phải danh mục chính thức của TOPIK.

- Mẫu được khớp trên **kết quả phân tích hình thái**, không phải trên chuỗi chữ: `먹고 싶어요`, `먹고싶어요` (viết liền) và `먹고 싶지 않아요` đều ra `V-고 싶다`. Có cả mẫu có khoảng cách (`별로 … 않다`, `아무리 … -아도`).
- Mỗi mẫu có: dạng, nghĩa, mức Lv, ghi chú, 2–3 câu ví dụ (Hàn + Việt). **Mọi câu ví dụ đều được test chạy qua bộ phân tích và phải nhận ra đúng mẫu của nó** — mẫu mà ví dụ không được nhận ra thì không thể vào bản phát hành.
- Thẻ cho mẫu chứa từ bạn bấm lên trước (“Mẫu ngữ pháp · n”, mở sẵn), các mẫu còn lại của câu nằm trong “Các mẫu khác trong câu”. Mẫu dễ nhầm với cách dùng khác, hoặc cần chọn cách đọc không mặc định, được gắn nhãn *Có thể nhầm* / *Rất không chắc* kèm lý do.
- Phụ đề có nhiều câu: thẻ phân tích **câu chứa từ bạn bấm** và ghi “Câu 2/3 của phụ đề”.

### 3.3 Cấu trúc câu

Bộ phân tích cấp câu (`sentence.js`) **dựa trên quy tắc, nông, và nói rõ điều đó** (thẻ có dòng “không phải bộ phân tích cú pháp đầy đủ”). Nó đọc từ trợ từ, đuôi và các mẫu đã khớp:

- **Cả câu:** loại câu (kể, hỏi, mệnh lệnh, rủ rê, ý định, cảm thán, phỏng đoán, bỏ lửng, cụm cố định), mức độ lịch sự (합쇼체, 해요체, 해체, 해라체, 하오체, 하게체), thì/thể, kính ngữ, phủ định, từ để hỏi.
- **Từng từ:** vai trò (chủ ngữ, chủ đề, tân ngữ, địa điểm/đích, nơi xảy ra hành động, người nhận, phương tiện, định ngữ, vị ngữ, vị ngữ mệnh đề phụ…). Trong vị ngữ phức (`먹고 싶다`, `찾고 있다`, `가 보다`) động từ chính được gọi là *Động từ chính của cụm vị ngữ* thay vì bị dịch nhầm là “ăn và”.
- **Mệnh đề:** ranh giới ở đuôi cuối câu / đuôi liên kết, kèm quan hệ (nguyên nhân, điều kiện, nhượng bộ, đối lập, mục đích, nối tiếp, đồng thời, trích dẫn, thời gian…). Lời được trích (`“…”라고 말했어요`) là một câu riêng, không quyết định loại câu hay thì của câu dẫn.
- **Trật tự:** khung S–O–V rút gọn của mệnh đề chính (`Chủ đề → Tân ngữ → Vị ngữ`).

### 3.4 Tab Grammar (tham chiếu, tra cứu)

Tab **Grammar** của popup/trang đầy đủ là bản tham chiếu đọc được ngoài lúc xem phim: **28 mục, 591 điểm** — 18 chủ đề cấu trúc câu, 189 cấu trúc + 53 đuôi (cùng danh mục ở trên), 73 trợ từ, 258 đuôi còn lại trong bảng tra nhanh. Chọn mục từ danh sách thả xuống, **tìm kiếm** bằng tiếng Hàn (`싶다`) hoặc tiếng Việt **không cần dấu** (`nguyen nhan` ra nhóm *Nguyên nhân · lý do*), kết quả xếp theo độ liên quan, mỗi điểm mở ra giải thích + ví dụ.

### 3.5 Giới hạn đã biết (nói thẳng)

*Từ và hình thái*
- Thẻ từ lúc bấm **không có ngữ cảnh** để chọn giữa các từ đồng âm (`사는` = 살다/사다): nó **báo là mơ hồ** và liệt kê cách đọc khác. Bộ phân tích cấp câu chọn được tốt hơn nhờ mẫu, nhưng vẫn có thể sai.
- Từ viết liền nhiều từ (`이리와`, `빨리와`), số + đơn vị lạ (`쉰살`, `두시쯤에`) và vài dạng rút gọn (`어쨌어`) có thể bị tách sai; kết quả loại này luôn được hạ độ tin cậy. Tokenizer tách chữ số khỏi đơn vị Hangul.
- Từ điển hữu hạn (9 587 mục, xem §4): từ lạ, tên riêng, tiếng lóng, thành ngữ hiếm sẽ hiện *chưa có trong từ điển*. Một số từ thô tục được ghi nhãn để nhận ra, không để khuyến khích.
- Phiên âm: có liên âm, biến âm (cuối âm tiết, mũi hóa, âm bên, bật hơi, vòm hóa, căng hóa trong từ); chưa có ㄴ-thêm trong từ ghép và ngoại lệ Hán-Hàn.
- Hán-Việt chỉ có cho **200 từ Hán-Hàn thông dụng + 60 động từ 하다/되다 dựng trên chúng**; các từ khác không có dòng này.
- Phụ đề dạng **hình ảnh** (bitmap) không có chữ để đọc → không thể bấm.

*Ngữ pháp và câu*
- Đây là bộ khớp mẫu theo quy tắc **không phải bộ phân tích cú pháp đầy đủ**. Câu dài, câu nói tắt, câu bỏ lửng, tên riêng có thể bị nhận sai; mệnh đề là các đoạn liên tiếp (chưa có cây phụ thuộc, câu lồng nhau chỉ được xấp xỉ).
- Trong vị ngữ phức, từ phụ ở cuối vẫn hiện nghĩa từ điển của nó (`있어요` = ở / có trong `찾고 있어요`); nghĩa của cả cụm nằm ở mục *Mẫu ngữ pháp* (`V-고 있다` = đang …).
- Câu viết sai chính tả rồi được đoán lại (`그건 안되요`) có thể bị coi là *câu bỏ lửng*; một từ cảm thán đứng cạnh dấu hỏi (`왜 그래?`) có thể bị đọc thành thán từ; chủ ngữ đứng trước một lời trích có thể hiện chung với mệnh đề trích.
- 242 mẫu **chưa phải toàn bộ** ngữ pháp tiếng Hàn: nó phủ phần lớn cấu trúc sơ – trung cấp thường gặp trong thoại phim, còn văn viết, thành ngữ hiếm và biến thể vùng miền thì thiếu nhiều.

*Kiểm chứng*
- Nội dung chưa được người bản ngữ rà soát (xem đầu trang). Chưa thử trên Netflix thật / NflxMultiSubs thật / Firefox bản chính thức / giọng đọc thật / toàn màn hình thật (xem §7).

---

## 4. Từ điển và cách mở rộng

`data/korean/dictionary.json` (**9 587 mục**, ≈ 572 KB, biên dịch từ các tệp nguồn) là bộ từ vựng **do dự án biên soạn**, nghĩa tiếng Việt, **không** dùng API trả phí, không cần tài khoản, không gọi mạng. Thành phần: danh từ 5 741 · động từ 1 987 · tính từ 736 · phó từ 591 · thán từ 130 · cụm từ 117 · định từ 58 · đại từ 56 · đơn vị đếm 53 · số từ 46 · danh từ phụ thuộc 33 · liên từ 31 · trợ động từ 7 · 이다 1. Thứ tự mục ≈ độ thường gặp (dùng để xếp hạng các cách đọc mơ hồ).

Kiến trúc tách rời: `DictionaryManager.lookup(word, language)` → `DictionaryProvider` → `LocalProvider`; core không biết đó là từ điển Hàn.

**Nguồn dữ liệu — nói thẳng.** Nghĩa tiếng Việt, ghi chú và ví dụ do dự án viết (với AI hỗ trợ), không chép từ từ điển hay sách giáo khoa. Trong lúc mở rộng, hai nguồn bên ngoài chỉ được *tham khảo để tìm xem còn thiếu từ phổ biến nào* và **không có mục, nghĩa, ví dụ hay tệp nào từ chúng nằm trong gói hay kho mã**. Chi tiết: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Mở rộng từ điển
Dữ liệu nguồn nằm ở `data/korean/dictionary.src.txt` (lõi, có danh sách `#priority`) và `data/korean/sources/*.txt` (43 tệp theo chủ đề, nạp theo thứ tự tên; một cặp *từ + loại từ* đã được tệp trước định nghĩa thì dòng sau bị bỏ qua). Mỗi dòng:

```
từ|loại từ|nghĩa 1; nghĩa 2|cờ bất quy tắc (tùy chọn)
먹다|v|ăn; uống (thuốc)
```

```bash
npm run dict        # biên dịch lại dictionary.json (báo lỗi nếu có dòng sai)
npm test            # kiểm tra dictionary.json còn đồng bộ, mọi động từ vẫn “khứ hồi” được, ví dụ ngữ pháp vẫn khớp
```
- Loại từ: `n pron num cnt nbound det adv int conj v adj aux cop phrase`. Động từ/tính từ ghi ở dạng từ điển (`먹다`); cờ `ㅂ ㄷ ㅅ ㅎ 르 러 reg` chỉ cần khi quy tắc tự động đoán sai.
- **Không dùng dấu `;` bên trong ngoặc đơn** của nghĩa (trình biên dịch dùng `;` để tách nghĩa và sẽ báo lỗi) — viết dấu phẩy.
- `data/korean/hanja.txt`: `từ|Hán tự|âm Hán-Việt` cho từ Hán-Hàn. Test bắt buộc mỗi âm tiết của từ có đúng một chữ Hán và mỗi chữ Hán có đúng một âm Hán-Việt.
- Số đếm thuần Hàn 1–4 viết liền với đơn vị đếm (`두명`, `세잔`…) được **sinh tự động**: sửa `scripts/gen-numeral-counters.js` rồi `node scripts/gen-numeral-counters.js && npm run dict`; một test so tệp sinh ra với tệp đã commit.
- Muốn dùng nguồn khác (ví dụ KRDict, Wiktionary): viết thêm một `DictionaryProvider` và đăng ký bằng `LF.dictionaries.register('ko', provider)` — *chú ý giấy phép của dữ liệu*.

### Mở rộng ngữ pháp
Thêm một dòng vào `src/languages/korean/grammar-patterns.js` (cú pháp mẫu ở đầu `patterns.js`, ví dụ `V-(으)ㄹ 수 있다` = `P@-(으)ㄹ N=수+~ P=있다|없다`), kèm 2–3 câu ví dụ có từ trong từ điển, rồi `npm test`. Chi tiết trong [CONTRIBUTING.md](CONTRIBUTING.md).

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
├── Popup / trang đầy đủ (Home · Vocabulary · Review · Grammar · Settings) · Background (rất nhỏ)
└── Language Packs
    └── Korean (v1)        Japanese · Chinese · English · … (Coming soon)
```

```
linguaflow/
├── manifest.json · README.md · README.en.md · CHANGELOG.md · CONTRIBUTING.md · THIRD_PARTY_NOTICES.md · LICENSE · build.sh · package.json
├── src/core/{subtitle,dictionary,vocabulary,review,pronunciation,language}/ · settings.js · i18n.js · util.js
├── src/languages/korean/{index,tokenizer,morphology,particles,endings,conjugation,numerals,honorifics,dictionary,hangul,romanization,
│                         patterns,grammar-patterns,grammar-guide,sentence,grammar-view}.js
├── src/content/{overlay.js,overlay-styles.js,learning-controller.js,content-main.js}
├── src/popup/{popup.html,page.html,popup.css,popup.js} · src/background/background.js
├── data/korean/{dictionary.json,dictionary.src.txt,hanja.txt,sources/*.txt} · icons/
├── scripts/{build-dictionary,gen-numeral-counters,check-syntax,make-zip,run-tests}.js
└── tests/{korean,subtitle,vocabulary,core,helpers}/ · tests/e2e/   (E2E trên Gecko thật, xem §7)
```
> `ReviewEngine` nằm ở `core/review/` (theo cây thư mục ở yêu cầu §19; §10 liệt kê nó cạnh vocabulary).

**Interface** (`src/core/language/language-pack.js`): `getId() getName() getNativeName() tokenize(text) analyzeWord(word) lookup(word) getPronunciation(word) getWordForm(word) getBaseForm(word)` + `getSpeechLang() detect(text) init()` và các hook **tùy chọn**: `getExtraForms()`, `getExternalLinks()`, **`analyzeSentence(text, {focus})`** (ngữ pháp của câu chứa từ được bấm; trả `null` nếu pack chưa có), **`getGrammarReference()`** (nội dung cho tab Grammar) và trường `etymology` trong kết quả `lookup()` (dòng “Hán tự · Hán-Việt” của tiếng Hàn). Mọi nhãn cho người học do **pack** viết; core chỉ bày ra. Core chỉ gọi interface — một test tự động quét `src/core` để chắc không có nhánh `if (language === 'ko')`.

`SentenceAnalysis` (trả bởi `analyzeSentence`): `{ text, offset, sentenceCount, sentenceIndex, facts[{id,label,value,hint?}], patterns[{id,title,meaning,note,level,category,categoryLabel,kind,text,confidence,notes,focus,examples}], words[{index,text,role,roleLabel,roleHint,lemma,posLabel,gloss,confidence,clause,focus,patterns}], clauses[{index,text,kind,kindLabel,relationLabel,predicate,ending,label}], structure[{role,label}] }`.

**Phát hiện phụ đề.** Một `MutationObserver` (debounce 30 ms, **không** `setInterval`, không quét toàn trang liên tục), chỉ xử lý khi chữ phụ đề *thật sự đổi* (có cache); nếu trình phát vẽ lại **đúng dòng cũ vào nút văn bản mới** (đổi cỡ cửa sổ, vẽ lại), bản đồ từ được dựng lại trên nút mới để rê/bấm vẫn hoạt động. Adapter đọc:
- NflxMultiSubs 2.2.1: phụ đề thứ hai là **một `<text>` SVG** trong `svg.nflxmultisubs-subtitle-svg` (cấu trúc lấy từ mã nguồn của nó); phụ đề chính vẫn là DOM gốc của Netflix.
- Netflix: `.player-timedtext > .player-timedtext-text-container > span` (dòng cách nhau bằng `<br>`).

`getCurrentSubtitle()` trả `{ primary:{language,text}, secondary:{language,text}, timestamp, videoTime, source }`. Dòng nào là “primary” do **language pack** quyết định (`detect()`), không phải core.

**Bấm từ không cần vẽ phụ đề.** Vị trí từng từ được tính **tại thời điểm rê/bấm** (Range cho chữ HTML, `getExtentOfChar` cho SVG), nên luôn đúng dù Netflix/NflxMultiSubs dời, phóng to hay chuyển toàn màn hình. Hộp tô sáng và thẻ từ nằm trong một Shadow DOM riêng (CSS của Netflix không lọt vào, CSS của ta không lọt ra; dùng `adoptedStyleSheets` nên sống được dưới CSP nghiêm ngặt). Thẻ chọn phía trên hoặc dưới dòng phụ đề nơi còn chỗ, giữ cách phụ đề ≥ 10 px, rút ngắn + cuộn bên trong khi quá cao, và đặt lại khi bạn mở một mục.

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
npm test             # toàn bộ unit test, ~30 giây (Node ≥ 18)
npm run check        # kiểm tra cú pháp toàn bộ .js/.json
npm run lint         # đóng gói + web-ext lint trên đúng các tệp của gói (cần mạng lần đầu để tải web-ext)
npm run e2e          # chạy gói zip trong Gecko thật (cần Firefox ≥ 140 + geckodriver, xem tests/e2e/README.md)
bash build.sh        # check + dictionary + test + đóng gói dist/*.zip (chỉ cần Node.js, không cần lệnh zip)
```

**Đã chạy và đạt** (trong môi trường phát triển của dự án này, ngày 2026-10-19, Node 22):
- `node scripts/check-syntax.js`: 75 tệp `.js/.json` hợp lệ.
- **254 unit test** (Node test runner + jsdom): tokenizer; chia động từ (quy tắc và bất quy tắc); “khứ hồi” mọi động từ trong từ điển; số, đơn vị, kính ngữ; phát âm/romanization; **mọi câu ví dụ của danh mục ngữ pháp và của phần cấu trúc câu được nhận ra đúng mẫu / đúng từ điển**; phân tích câu (vai trò, mệnh đề, trích dẫn, vị ngữ phức); phát hiện phụ đề (Netflix gốc, NflxMultiSubs SVG, hai bố cục đảo ngược, phụ đề đổi/xóa/vẽ lại, nút ẩn, selector tùy chỉnh, phụ đề hình ảnh); từ vựng, ôn tập, nhập/xuất; overlay (kể cả vị trí thẻ so với phụ đề); luồng bấm → thẻ → lưu → đóng/phát lại; popup/trang đầy đủ chạy từ HTML thật; dữ liệu Hán tự; kiểm toán quyền riêng tư; gói extension có đủ LICENSE + THIRD_PARTY_NOTICES và không chứa tệp phát triển; CHANGELOG có mục cho đúng phiên bản; dòng *Made with ♥ by AVYRON* có mặt trên mọi tab, trái tim là ảnh chứ không phải emoji, liên kết an toàn, manifest ghi tác giả AVYRON.
- `bash build.sh --lint` chạy hết một mạch (cú pháp → từ điển → unit test → đóng gói → `web-ext lint` 10.8.0 của Mozilla trên đúng các tệp của gói extension): **0 lỗi, 0 cảnh báo, 0 thông báo**. Gói extension: 54 tệp, ≈ 352 KB. Lint là kiểm tra *tĩnh* (manifest, quyền, mẫu mã bị cấm) — nó **không** chứng minh add-on chạy đúng (đó là việc của unit test và của lần chạy trong Gecko bên dưới) và **không** thay cho khâu duyệt của addons.mozilla.org.
- **Chạy thật trong engine Gecko** (Zen Browser 1.23.3b — nhân Firefox 158 — headless, cài gói zip như add-on MV3 tạm thời) trên một trang “Netflix giả” có layout thật (chữ HTML + SVG `<text>` kiểu NflxMultiSubs, `<video>` đang chạy thật): **51/51 kiểm tra đạt**. Gồm: content script được tiêm; hộp tô sáng khớp ô chữ ≤ 6 px; bấm chữ HTML và chữ SVG mở đúng thẻ; cú bấm không lọt tới trang; video tạm dừng rồi `Esc` phát lại; **thẻ không che dòng phụ đề nào, kể cả khi mở hết các mục**; dòng cũ vẽ lại vào nút mới vẫn bấm được; 🔊 báo rõ khi máy không có giọng; lưu từ rồi thấy ở trang Vocabulary và Review; tab Grammar (28 mục, tìm không dấu); công tắc Grammar ở tab khác có hiệu lực ngay; giao diện tiếng Anh; trang popup; Firefox báo tác giả add-on là AVYRON; dòng credit nằm gọn dưới thanh tab (popup 360 × 580 và trang đầy đủ), ảnh trái tim giải mã được, đập khi rê chuột và đứng yên khi hệ thống bật “giảm chuyển động”; thẻ vẫn đúng kiểu và từ điển vẫn nạp được khi trang có CSP nghiêm ngặt. Bộ chạy này nằm trong repo (`tests/e2e/`) nên bạn tự chạy lại được. Lần chạy này **đã tìm ra hai lỗi thật** mà unit test không thấy (thẻ đè lên phụ đề khi quá cao; hover/bấm hỏng khi trình phát vẽ lại đúng dòng cũ) — cả hai đã sửa và có test.

**Chưa kiểm chứng được (nói thẳng):**
- **Netflix thật** (cần tài khoản và nội dung có DRM) và **NflxMultiSubs thật** chạy cùng nhau. Cấu trúc DOM của chúng được dựng lại từ mã nguồn NflxMultiSubs 2.2.1 và mô tả Netflix timed text — Netflix có thể đổi bất kỳ lúc nào (xem mục 6).
- **Firefox bản chính thức**: máy build không tải được; test chạy trên Zen (nhân Gecko của Firefox). Hành vi API WebExtension giống nhau, nhưng bạn nên thử trên Firefox của mình.
- **Giọng đọc thật** (máy build không có TTS) — phần hiển thị lỗi “thiếu giọng” đã test, phần phát tiếng thật thì chưa.
- **Toàn màn hình thật trên Netflix**: logic gắn lại overlay vào phần tử fullscreen đã test bằng jsdom, chưa test trên Netflix.
- **Chất lượng tiếng Hàn–Việt** (nghĩa, giải thích, ví dụ, Hán-Việt): chưa có người bản ngữ rà soát.

---

## 8. Quyền riêng tư

- Quyền: chỉ `storage` + site `https://www.netflix.com/*`. Không `tabs`, `cookies`, `history`, `webRequest`, `<all_urls>`.
- Không `XMLHttpRequest`, `sendBeacon`, `WebSocket`, không mã từ xa, không `eval`, không `innerHTML` (mọi chữ phụ đề đi qua text node). `fetch` chỉ đọc **tệp đóng gói sẵn** trong extension (từ điển). Test `tests/core/package.test.js` quét mã nguồn để giữ các điều này. (Bộ E2E chỉ chạy trên máy phát triển, nói chuyện với một trang giả ở `127.0.0.1`, và không nằm trong gói extension.)
- Nút tra từ điển online (Naver, Wiktionary) **tắt mặc định**; khi bật, chỉ mở tab mới **khi bạn bấm**.
- Dòng *Made with ♥ by AVYRON* ở chân popup và trang đầy đủ (trái tim là ảnh SVG `icons/heart.svg`, không phải emoji) chỉ là một liên kết thường tới trang GitHub của tác giả: nó mở tab mới **khi bạn bấm**, extension không tự gọi mạng. Manifest ghi tác giả là AVYRON nên Firefox hiện “by AVYRON” ở `about:addons`.
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
    async lookup(word) { /* { word, lemma, pos, meanings[], pronunciation, examples[], confidence, etymology? } */ }
    getPronunciation(word) { return { text: word, lang: 'ja-JP', romanization: /* romaji */ }; }
    getWordForm(word) { /* mô tả dạng ngữ pháp */ }
    getBaseForm(word) { return this.analyzeWord(word).lemma; }
    // Tùy chọn: analyzeSentence(text, { focus }) → SentenceAnalysis | null ; getGrammarReference() → [{ id, title, items }]
    //           (nếu không viết, thẻ không có phần ngữ pháp và tab Grammar trống — mọi thứ khác vẫn chạy)
  }
  LF.LanguagePackManager.register(new JapaneseLanguagePack());
})(globalThis);
```

**Bước 3 — dữ liệu:** `data/japanese/dictionary.json` cùng schema (`{ meta, entries: { từ: { pos, meanings[], … } } }`). Nếu lấy từ nguồn mở như JMdict, **tuân thủ giấy phép và ghi công** (JMdict: CC BY-SA 4.0) và ghi vào `THIRD_PARTY_NOTICES.md`.

**Bước 4 — nối vào extension** (3 chỗ, đều chỉ là danh sách tệp): thêm các tệp của pack vào `content_scripts[0].js` trong `manifest.json` *trước* `src/content/overlay-styles.js`; thêm vào danh sách `<script>` của `src/popup/popup.html` và `page.html` (trước `popup.js`); thêm `data/japanese/dictionary.json` vào `web_accessible_resources`.

**Bước 5 — xong.** `日本語` tự chuyển từ *Coming soon* sang chọn được trong popup (danh sách lấy từ `LanguagePackManager.listAll()`), `settings.language = 'ja'`, từ vựng lưu `language: "ja"`, 🔊 dùng `ja-JP`. Viết test trong `tests/japanese/` (helper `tests/helpers/load.js` nạp tệp theo đúng thứ tự manifest).

---

## Lộ trình
Tiếng Nhật/Trung/Anh/Tây Ban Nha/Pháp/Đức · người bản ngữ / giáo viên rà soát dữ liệu tiếng Hàn–Việt · từ điển lớn hơn qua provider mới và mở rộng Hán-Việt · dùng ngữ cảnh câu để gỡ mơ hồ ngay trên thẻ từ · gạch chân từ đã lưu trên phụ đề · đồng bộ thủ công (tệp xuất/nhập) giữa các máy · thử trên Netflix thật và Firefox bản chính thức khi có điều kiện.

## Giấy phép
MIT (xem `LICENSE`). “Netflix” và “NflxMultiSubs” là tên của chủ sở hữu tương ứng; LinguaFlow độc lập, không liên kết và không chứa mã của họ. Nguồn gốc dữ liệu: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
