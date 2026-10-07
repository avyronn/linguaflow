/* Tiny i18n: the extension UI in Vietnamese (default) or English. Dictionary glosses are a separate matter
 * (they come from the language pack's dictionary). Missing keys fall back vi -> en -> the key itself. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  const STRINGS = {
    vi: {
      'brand.tagline': 'Learn languages while watching.',
      'nav.home': 'Trang chủ', 'nav.vocabulary': 'Vocabulary', 'nav.review': 'Review', 'nav.settings': 'Settings',
      'home.language': 'Ngôn ngữ đang học', 'lang.comingSoon': 'Sắp ra mắt', 'lang.current': 'Đang học',
      'opt.learningMode': 'Learning mode', 'opt.clickWords': 'Click words', 'opt.morphology': 'Morphology', 'opt.vocabulary': 'Vocabulary', 'opt.pronunciation': 'Pronunciation',
      'opt.learningMode.hint': 'Bật/tắt toàn bộ LinguaFlow (Alt+Shift+L)',
      'home.stats': '{total} từ đã lưu · {due} cần ôn',
      'home.hint': 'Mở một phim trên Netflix, bật phụ đề {language} rồi bấm vào một từ trên phụ đề.',
      'home.openTab': 'Mở toàn trang',
      'card.speak': 'Nghe phát âm', 'card.close': 'Đóng', 'card.save': 'Lưu từ', 'card.saved': 'Đã lưu', 'card.known': 'Đã biết',
      'card.notInDict': 'Chưa có trong từ điển cục bộ.', 'card.originalWord': 'Từ gốc trên phụ đề', 'card.baseForm': 'Dạng từ điển', 'card.otherReadings': 'Cách phân tích khác',
      'card.viewBase': 'Xem từ gốc', 'card.hideBase': 'Ẩn', 'card.sentence': 'Câu gốc & bản dịch',
      'card.conf.low': 'Analysis confidence: low', 'card.conf.medium': 'Analysis confidence: medium', 'card.conf.high': 'Analysis confidence: high',
      'toast.noVoice': 'Máy chưa có giọng đọc {language}. Linux: cài speech-dispatcher + một giọng {lang} (xem README).',
      'toast.noVoices': 'Trình duyệt không thấy giọng đọc nào. Linux: cài speech-dispatcher (xem README).',
      'toast.unsupported': 'Trình duyệt này không hỗ trợ Web Speech.', 'toast.speechError': 'Không phát âm được.',
      'toast.dictFailed': 'Không tải được từ điển. Hãy tải lại trang.', 'toast.saveFailed': 'Không lưu được từ này.',
      'vocab.search': 'Tìm từ…', 'vocab.filter.all': 'Tất cả', 'vocab.filter.learning': 'Đang học', 'vocab.filter.known': 'Đã biết',
      'vocab.empty': 'Chưa có từ nào. Bấm vào một từ trên phụ đề rồi chọn “Lưu từ”.', 'vocab.delete': 'Xóa', 'vocab.markKnown': 'Đã biết', 'vocab.markLearning': 'Học lại',
      'vocab.exportJson': 'Xuất JSON', 'vocab.exportCsv': 'Xuất CSV', 'vocab.import': 'Nhập JSON', 'vocab.importDone': 'Đã nhập {added} từ (bỏ qua {skipped}, lỗi {invalid}).',
      'vocab.importFail': 'Không đọc được tệp: {error}', 'vocab.next': 'Ôn lúc', 'vocab.reviewed': 'đã ôn {n} lần', 'vocab.count': '{n} từ',
      'review.show': 'Show answer', 'review.done': 'Hết thẻ cần ôn hôm nay 🎉', 'review.empty': 'Chưa có thẻ nào cần ôn. Hãy lưu thêm từ khi xem phim.',
      'review.progress': 'Còn {n} thẻ', 'review.again': 'Again', 'review.hard': 'Hard', 'review.good': 'Good', 'review.easy': 'Easy', 'review.context': 'Câu gốc', 'review.speak': 'Nghe',
      'set.ui': 'Ngôn ngữ giao diện', 'set.pause': 'Tạm dừng video khi mở thẻ từ', 'set.resume': 'Tự phát lại khi đóng thẻ từ', 'set.romanization': 'Hiện phiên âm La-tinh',
      'set.rate': 'Tốc độ đọc', 'set.external': 'Hiện nút tra từ điển online (chỉ mở tab khi bạn bấm)', 'set.selectors': 'Bộ chọn phụ đề tùy chỉnh (CSS)',
      'set.selectors.hint': 'Mỗi dòng một CSS selector. Dùng khi Netflix đổi giao diện — xem README → “Nếu Netflix đổi DOM”.',
      'set.debug': 'Ghi log gỡ lỗi (Alt+Shift+D mở bảng chẩn đoán)', 'set.data': 'Dữ liệu của bạn',
      'set.data.hint': 'Mọi thứ nằm trong trình duyệt này (browser.storage.local). Không tài khoản, không đám mây, không theo dõi.',
      'set.reset': 'Khôi phục cài đặt mặc định', 'set.deleteAll': 'Xóa toàn bộ từ vựng', 'set.deleteAll.confirm': 'Xóa TOÀN BỘ từ vựng đã lưu? Không thể hoàn tác.', 'set.saved': 'Đã lưu',
    },
    en: {
      'brand.tagline': 'Learn languages while watching.',
      'nav.home': 'Home', 'nav.vocabulary': 'Vocabulary', 'nav.review': 'Review', 'nav.settings': 'Settings',
      'home.language': 'Learning language', 'lang.comingSoon': 'Coming soon', 'lang.current': 'Learning',
      'opt.learningMode': 'Learning mode', 'opt.clickWords': 'Click words', 'opt.morphology': 'Morphology', 'opt.vocabulary': 'Vocabulary', 'opt.pronunciation': 'Pronunciation',
      'opt.learningMode.hint': 'Turns all of LinguaFlow on/off (Alt+Shift+L)',
      'home.stats': '{total} saved · {due} due',
      'home.hint': 'Open a title on Netflix, turn on {language} subtitles, then click any word in the subtitle.',
      'home.openTab': 'Open full page',
      'card.speak': 'Listen', 'card.close': 'Close', 'card.save': 'Save word', 'card.saved': 'Saved', 'card.known': 'Known',
      'card.notInDict': 'Not in the local dictionary yet.', 'card.originalWord': 'Word on the subtitle', 'card.baseForm': 'Dictionary form', 'card.otherReadings': 'Other readings',
      'card.viewBase': 'Show base form', 'card.hideBase': 'Hide', 'card.sentence': 'Sentence & translation',
      'card.conf.low': 'Analysis confidence: low', 'card.conf.medium': 'Analysis confidence: medium', 'card.conf.high': 'Analysis confidence: high',
      'toast.noVoice': 'No {language} voice installed. Linux: install speech-dispatcher + a {lang} voice (see README).',
      'toast.noVoices': 'The browser sees no speech voices. Linux: install speech-dispatcher (see README).',
      'toast.unsupported': 'This browser has no Web Speech support.', 'toast.speechError': 'Could not play the pronunciation.',
      'toast.dictFailed': 'Could not load the dictionary. Reload the page.', 'toast.saveFailed': 'Could not save this word.',
      'vocab.search': 'Search words…', 'vocab.filter.all': 'All', 'vocab.filter.learning': 'Learning', 'vocab.filter.known': 'Known',
      'vocab.empty': 'No words yet. Click a word in a subtitle and choose “Save word”.', 'vocab.delete': 'Delete', 'vocab.markKnown': 'Known', 'vocab.markLearning': 'Learn again',
      'vocab.exportJson': 'Export JSON', 'vocab.exportCsv': 'Export CSV', 'vocab.import': 'Import JSON', 'vocab.importDone': 'Imported {added} words ({skipped} skipped, {invalid} invalid).',
      'vocab.importFail': 'Could not read the file: {error}', 'vocab.next': 'Next review', 'vocab.reviewed': 'reviewed {n}×', 'vocab.count': '{n} words',
      'review.show': 'Show answer', 'review.done': 'No more cards due today 🎉', 'review.empty': 'Nothing to review yet. Save some words while watching.',
      'review.progress': '{n} cards left', 'review.again': 'Again', 'review.hard': 'Hard', 'review.good': 'Good', 'review.easy': 'Easy', 'review.context': 'Original sentence', 'review.speak': 'Listen',
      'set.ui': 'Interface language', 'set.pause': 'Pause the video while a word card is open', 'set.resume': 'Resume playback when the card is closed', 'set.romanization': 'Show romanization',
      'set.rate': 'Speech rate', 'set.external': 'Show online dictionary links (a tab opens only when you click)', 'set.selectors': 'Custom subtitle selectors (CSS)',
      'set.selectors.hint': 'One CSS selector per line. Use when Netflix changes its markup — see README → “If Netflix changes its DOM”.',
      'set.debug': 'Debug logging (Alt+Shift+D opens the diagnostics panel)', 'set.data': 'Your data',
      'set.data.hint': 'Everything stays in this browser (browser.storage.local). No account, no cloud, no tracking.',
      'set.reset': 'Restore default settings', 'set.deleteAll': 'Delete all vocabulary', 'set.deleteAll.confirm': 'Delete ALL saved vocabulary? This cannot be undone.', 'set.saved': 'Saved',
    },
  };

  function create(lang) {
    const inst = {
      lang: lang === 'en' ? 'en' : 'vi',
      setLanguage(l) { inst.lang = l === 'en' ? 'en' : 'vi'; },
      t(key, params) {
        let s = (STRINGS[inst.lang] && STRINGS[inst.lang][key]) || STRINGS.vi[key] || STRINGS.en[key] || key;
        if (params) for (const k of Object.keys(params)) s = s.split('{' + k + '}').join(String(params[k]));
        return s;
      },
    };
    inst.t = inst.t.bind(inst);
    return inst;
  }

  LF.i18n = { STRINGS, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.i18n;
})(typeof globalThis !== 'undefined' ? globalThis : this);
