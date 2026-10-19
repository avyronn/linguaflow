/* Korean sentence-structure guide: short, example-driven explanations of how a Korean sentence is put together.
 * It is the "Cấu trúc câu" section of the grammar reference; the sentence analyser (sentence.js) labels the very same ideas
 * (word roles, clauses, speech level, tense) on the line the learner is watching.
 *
 * Row: [ id, title, level, summary, note, [[korean, vietnamese], ...] ]      (level 1-6 as in grammar-patterns.js)
 * Every example is checked by the test-suite: all its words must be in the bundled dictionary and must be analysed without "unknown" words.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const GUIDE = [
    ['order', 'Trật tự từ: Chủ ngữ – Tân ngữ – Vị ngữ', 1,
      'Vị ngữ (động từ / tính từ) luôn đứng CUỐI câu.',
      'Tiếng Hàn là ngôn ngữ S–O–V: chủ ngữ → các bổ ngữ (thời gian, nơi chốn …) → tân ngữ → vị ngữ. Tiếng Việt đặt động từ ngay sau chủ ngữ (S–V–O), còn tiếng Hàn dồn động từ về cuối, nên khi nghe phải chờ đến cuối câu mới biết “làm gì”, “có / không”, “hỏi hay kể”.',
      [['저는 밥을 먹어요.', 'Tôi ăn cơm.'], ['친구가 학교에 가요.', 'Bạn tôi đi đến trường.'], ['어제 친구를 만났어요.', 'Hôm qua tôi đã gặp bạn.']]],
    ['particles', 'Trợ từ đánh dấu vai trò trong câu', 1,
      'Mỗi danh từ gắn một trợ từ cho biết nó đóng vai gì: -이/가 chủ ngữ, -은/는 chủ đề, -을/를 tân ngữ, -에 nơi chốn / thời điểm, -에서 nơi diễn ra hành động.',
      'Vai trò của từ được thể hiện bằng trợ từ chứ không phải bằng vị trí, nên các thành phần đứng trước vị ngữ có thể đổi chỗ cho nhau để nhấn mạnh, miễn là vị ngữ vẫn ở cuối. Trợ từ viết liền với từ đứng trước nó, không có khoảng trắng.',
      [['어제 학교에서 친구를 만났어요.', 'Hôm qua tôi đã gặp bạn ở trường.'], ['친구를 어제 학교에서 만났어요.', 'Bạn thì hôm qua tôi đã gặp ở trường. (đổi trật tự để nhấn mạnh “bạn”)']]],
    ['topic', 'Chủ đề (-은/는) và chủ ngữ (-이/가)', 1,
      '-은/는 nêu chủ đề, thông tin đã biết hoặc đối chiếu; -이/가 đưa ra thông tin mới hoặc nhấn mạnh người / vật thực hiện.',
      'Một câu có thể có cả hai: “오늘은 날씨가 좋아요” = “Còn hôm nay thì thời tiết đẹp” (chủ đề: hôm nay; chủ ngữ: thời tiết). Với từ để hỏi làm chủ ngữ (누가, 뭐가) luôn dùng -이/가.',
      [['저는 학생이에요.', 'Tôi là sinh viên.'], ['누가 왔어요?', 'Ai đã đến vậy?'], ['오늘은 날씨가 좋아요.', 'Hôm nay thời tiết đẹp.']]],
    ['omission', 'Lược bỏ chủ ngữ và tân ngữ', 1,
      'Khi ngữ cảnh đã rõ, người Hàn thường bỏ “tôi”, “bạn” và cả tân ngữ.',
      'Hãy dựa vào đuôi câu và kính ngữ để đoán ai làm gì: -(으)세요 → người đáng kính; -(으)ㄹ게요 / -겠- → người nói; -(으)ㄹ까요? → “chúng ta?”. Đây là lý do một câu phụ đề tiếng Hàn thường ngắn hơn bản dịch.',
      [['밥 먹었어요?', 'Bạn ăn cơm chưa?'], ['네, 먹었어요.', 'Rồi, tôi ăn rồi.'], ['어디 가요?', 'Bạn đi đâu đấy?']]],
    ['copula', 'Vị ngữ danh từ (N이다) và vị ngữ tính từ', 1,
      'Danh từ + 이다 = “là …”; tính từ tự làm vị ngữ, không cần thêm “thì / là”.',
      'N이에요 / N예요 (sau phụ âm / sau nguyên âm), N입니다 (trang trọng), N이야 / N야 (thân mật). Phủ định: N이/가 아니에요. Với tính từ: 날씨가 좋아요 (thời tiết đẹp) — tính từ chia đuôi giống động từ.',
      [['이것은 책이에요.', 'Đây là quyển sách.'], ['날씨가 좋아요.', 'Thời tiết đẹp.'], ['이것은 제 책이 아니에요.', 'Đây không phải sách của tôi.']]],
    ['modifier', 'Định ngữ đứng TRƯỚC danh từ', 2,
      'Động từ / tính từ làm định ngữ nhờ đuôi -(으)ㄴ, -는, -(으)ㄹ, -던 và đứng trước danh từ — kể cả một mệnh đề dài.',
      'Tiếng Việt đặt phần bổ nghĩa SAU danh từ (“bộ phim tôi xem hôm qua”), tiếng Hàn đặt TRƯỚC (“hôm qua tôi xem bộ phim”). Tính từ: -(으)ㄴ (예쁜 꽃). Động từ: hiện tại -는 (먹는 사람), quá khứ -(으)ㄴ (먹은 사람), tương lai / dự định -(으)ㄹ (먹을 사람), hồi tưởng -던 (먹던 사람).',
      [['예쁜 꽃을 샀어요.', 'Tôi đã mua những bông hoa đẹp.'], ['어제 본 영화가 재미있었어요.', 'Bộ phim tôi xem hôm qua rất thú vị.'], ['제가 좋아하는 음식은 김치예요.', 'Món tôi thích là kim chi.']]],
    ['levels', 'Sáu mức độ lịch sự (đuôi câu)', 1,
      'Cùng một ý nhưng đuôi câu thay đổi theo người nghe: trang trọng (-ㅂ니다/습니다), lịch sự thông thường (-아요/어요), thân mật (-아/어), trống không (-다).',
      '합쇼체 -ㅂ니다/습니다: thông báo, công việc, nói với người trên. 해요체 -아요/어요: hằng ngày, người lớn tuổi, người mới quen. 해체 (반말) -아/어, -지: bạn bè thân, người nhỏ hơn. 해라체 -다: văn viết, nói với trẻ nhỏ. 하오체 / 하게체: kiểu cổ, thường nghe trong phim cổ trang.',
      [['감사합니다.', 'Xin cảm ơn. (trang trọng)'], ['고마워요.', 'Cảm ơn nhé. (lịch sự thông thường)'], ['고마워.', 'Cảm ơn nha. (thân mật)']]],
    ['tense', 'Thì và thể', 1,
      'Thì được gắn vào vị ngữ: -았/었- (quá khứ), -겠- hoặc -(으)ㄹ 거예요 (tương lai / ý định / phỏng đoán), -고 있다 (đang).',
      'Tiếng Hàn không có thì hiện tại riêng: dạng không đánh dấu (먹어요) dùng cho hiện tại và cả thói quen, đôi khi cả tương lai gần khi có từ chỉ thời gian (내일 가요). Mỗi mệnh đề phụ thường không tự gắn thì, mà dựa vào vị ngữ cuối.',
      [['어제 영화를 봤어요.', 'Hôm qua tôi đã xem phim.'], ['내일 갈 거예요.', 'Ngày mai tôi sẽ đi.'], ['지금 먹고 있어요.', 'Bây giờ tôi đang ăn.']]],
    ['negation', 'Phủ định', 1,
      '안 + động từ / tính từ (không), 못 + động từ (không thể), -지 않다, -지 못하다, N이/가 아니다 (không phải là), -지 마세요 (đừng).',
      '안 và 못 đứng ngay trước vị ngữ; với động từ dạng “N하다” thì chen vào giữa: 공부 안 해요. Hai cách -지 않다 / 안 có nghĩa như nhau, -지 않다 trang trọng hơn.',
      [['저는 커피를 안 마셔요.', 'Tôi không uống cà phê.'], ['오늘은 못 가요.', 'Hôm nay tôi không đi được.'], ['여기서 사진을 찍지 마세요.', 'Xin đừng chụp ảnh ở đây.']]],
    ['question', 'Câu hỏi và từ để hỏi', 1,
      'Không đảo trật tự câu: giữ nguyên câu kể rồi lên giọng; từ để hỏi đứng đúng vị trí của phần được hỏi.',
      '뭐 (cái gì), 누구 (ai), 어디 (đâu), 언제 (khi nào), 왜 (tại sao), 어떻게 (như thế nào), 얼마 (bao nhiêu), 몇 (mấy). Đuôi -아요/어요 dùng cho cả câu kể và câu hỏi, dấu hiệu duy nhất là ngữ điệu (và dấu “?” trong phụ đề).',
      [['지금 뭐 해요?', 'Bây giờ bạn đang làm gì?'], ['어디에 가요?', 'Bạn đi đâu đấy?'], ['이거 얼마예요?', 'Cái này bao nhiêu tiền vậy?']]],
    ['connect', 'Nối hai vế bằng đuôi liên kết', 2,
      'Giữa hai mệnh đề không có từ nối riêng: vế trước kết thúc bằng một đuôi liên kết như -고 (và / rồi), -아서/어서 (vì / rồi), -(으)면 (nếu), -지만 (nhưng).',
      'Chỉ vị ngữ của vế CUỐI mang mức độ lịch sự (và thường cả thì). Quan hệ giữa hai vế nằm trong đuôi liên kết: -고 nối tiếp / liệt kê, -아서/어서 nguyên nhân / trình tự, -(으)니까 lý do (dùng được với mệnh lệnh), -(으)면 điều kiện, -지만 đối lập, -(으)려고 mục đích, -는데 bối cảnh.',
      [['밥을 먹고 영화를 봤어요.', 'Tôi ăn cơm rồi xem phim.'], ['비가 와서 집에 있었어요.', 'Vì trời mưa nên tôi ở nhà.'], ['비싸지만 맛있어요.', 'Đắt nhưng ngon.']]],
    ['nominal', 'Biến cả mệnh đề thành danh từ', 2,
      'V-는 것 (việc …), V-기 (thường đi với 좋다, 싫다, 쉽다, 어렵다 …), V-(으)ㅁ (văn viết) cho phép một mệnh đề làm chủ ngữ hoặc tân ngữ.',
      '-는 것 dùng rộng nhất và thông dụng nhất trong hội thoại; -기 hay đi với tính từ đánh giá (듣기 좋다 = dễ nghe) và thành ngữ cố định (-기 때문에, -기 전에); -(으)ㅁ xuất hiện trong tiêu đề, thông báo.',
      [['책을 읽는 것을 좋아해요.', 'Tôi thích đọc sách.'], ['말하기가 어려워요.', 'Nói thì khó.'], ['건강이 제일 중요해요.', 'Sức khỏe là quan trọng nhất.']]],
    ['quote', 'Trích dẫn lời nói', 3,
      'Lời nói được dẫn bằng -다고 / -(으)라고 / -자고 / -냐고 + 하다 (nói / bảo / rủ / hỏi).',
      'Chọn đuôi theo kiểu câu được dẫn: kể -다고, mệnh lệnh -(으)라고, rủ rê -자고, hỏi -(느)냐고. Khẩu ngữ hay rút gọn: -ㄴ/는대요, -(이)래요, -(으)래요, -재요.',
      [['친구가 내일 온다고 했어요.', 'Bạn nói là ngày mai sẽ đến.'], ['선생님이 빨리 오라고 했어요.', 'Thầy bảo hãy đến nhanh.'], ['내일 비가 온대요.', 'Nghe nói ngày mai trời mưa.']]],
    ['honorific', 'Kính ngữ', 2,
      'Khi chủ ngữ là người đáng kính: danh từ + -께서, vị ngữ + -(으)시-; một số từ có dạng kính ngữ riêng.',
      '먹다 → 드시다, 자다 → 주무시다, 있다 → 계시다, 말하다 → 말씀하시다; khiêm nhường khi nói về mình với người trên: 주다 → 드리다. Kính ngữ chủ thể (-(으)시-) và mức độ lịch sự với người nghe (-요, -ㅂ니다) là hai việc khác nhau.',
      [['할아버지께서 신문을 읽으세요.', 'Ông đang đọc báo.'], ['선생님께서 말씀하셨어요.', 'Thầy đã nói.']]],
    ['conjunction', 'Liên từ đầu câu', 1,
      '그리고 (và), 그래서 (cho nên), 그런데 (nhưng mà / à này), 하지만 (nhưng), 그러면 (vậy thì), 그래도 (dù vậy).',
      'Liên từ đứng ĐẦU câu mới và nối với câu trước; còn bên trong một câu thì dùng đuôi liên kết (-고, -아서/어서 …).',
      [['비가 와요. 그래서 집에 있어요.', 'Trời mưa. Cho nên tôi ở nhà.'], ['비싸요. 하지만 맛있어요.', 'Đắt. Nhưng ngon.']]],
    ['counters', 'Số đếm đứng sau danh từ', 1,
      'Danh từ + số từ + đơn vị đếm: 사과 두 개, 친구 세 명.',
      'Số thuần Hàn (하나, 둘, 셋 → 한, 두, 세 trước đơn vị đếm) đi với 개, 명, 마리, 살 …; số Hán-Hàn (일, 이, 삼) đi với 분, 년, 월, 원 … Trợ từ có thể gắn sau đơn vị đếm: 사과를 두 개 샀어요.',
      [['사과를 두 개 샀어요.', 'Tôi đã mua hai quả táo.'], ['친구가 세 명 왔어요.', 'Có ba người bạn đã đến.']]],
    ['adverb', 'Trạng từ đứng ngay trước từ nó bổ nghĩa', 1,
      '정말 (thật), 아주 (rất), 빨리 (nhanh), 천천히 (chậm rãi) … đứng trước động từ / tính từ mà chúng bổ nghĩa.',
      'Tính từ thêm -게 cũng thành trạng từ: 크다 → 크게 (to, lớn), 예쁘다 → 예쁘게 (một cách đẹp).',
      [['정말 맛있어요.', 'Ngon thật đấy.'], ['천천히 말해 주세요.', 'Làm ơn nói chậm thôi.']]],
    ['colloquial', 'Rút gọn trong văn nói', 2,
      'Văn nói hay nuốt âm: 저는 → 전, 나는 → 난, 그것은 → 그건, 이것이 → 이게, 뭐를 → 뭘.',
      'Phụ đề thường ghi đúng âm đọc, nên gặp những dạng rút gọn này rất nhiều. Khi một từ lạ trông như từ quen bị rút ngắn, thử mở rộng nó ra (그건 = 그것은).',
      [['난 괜찮아.', 'Tớ ổn mà.'], ['이게 뭐예요?', 'Cái này là cái gì vậy?'], ['그건 몰랐어요.', 'Cái đó thì tôi không biết.']]],
  ];

  K.GrammarGuide = { GUIDE };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.GrammarGuide;
})(typeof globalThis !== 'undefined' ? globalThis : this);
