/* Korean verb/adjective endings (어미) as data. The conjugation engine (conjugation.js) knows how each
 * `mode` attaches to a stem; morphology.js verifies candidate analyses by regenerating the surface.
 *
 * mode:  c  plain, consonant-initial ending      (고, 지만, 네요 ...)
 *        u  (으)-class ending                     (면, 니까, ㄴ, ㄹ, 세요 ...)
 *        a  아/어-class ending (vowel harmony)    (요, 서, 도 ... text = what follows 아/어)
 *        f  two explicit forms v|c                (ㅂ니다|습니다, ㄴ다|는다)
 * opts:  strong    - evidence strong enough to accept an unknown stem
 *        bare      - when the chain has no tense marker, only valid for this POS:
 *                      'v'  verbs and 있다/없다 (는-type endings)      'adj' adjectives, 이다 and 있다/없다 (다-type endings)
 *                      'v0' real verbs only (ㄴ다/는다-type endings: 있다/없다 are excluded)
 *        needsBare - invalid when a tense marker (았/었/겠) is present
 *        yo        - also generate a "+요" polite variant
 *        lvl       - speech level of a sentence-final ending: hapsyo | haeyo | hae | haera | hao | hage
 *        sent      - sentence type: decl | ques | imper | prop | excl | intent | guess
 *        rel       - relation a connective expresses: seq list cause cond conc contrast purpose bg simul alt degree quote time manner imm
 *        lv        - rough TOPIK level (1-6) at which learners meet it
 *        note, ex  - longer explanation (vi) and examples [[ko, vi], ...] for the grammar card
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const E = (id, mode, text, kind, label, compose, opts) =>
    Object.assign({ id, mode, text, kind, label, compose: compose || {}, type: 'ending' }, opts || {});
  const FIN = (id, mode, text, label, compose, opts) => E(id, mode, text, 'final', label, compose, opts);
  const CON = (id, mode, text, label, compose, opts) => E(id, mode, text, 'connective', label, compose, opts);
  const ADN = (id, mode, text, label, compose, opts) => E(id, mode, text, 'adnominal', label, compose, opts);

  const BASE = [
    // ====================================================================================================
    // 1. SENTENCE-FINAL ENDINGS, by speech level
    // ====================================================================================================
    // ---- 합쇼체 (formal polite) ----------------------------------------------------------------------
    FIN('-ㅂ니다/습니다', 'f', 'ㅂ니다|습니다', 'đuôi câu lịch sự, trang trọng', { style: 'lịch sự, trang trọng' },
      { strong: true, lvl: 'hapsyo', sent: 'decl', lv: 1, note: 'Mức lịch sự cao nhất, dùng trong thông báo, họp hành, quân đội, bản tin. Sau phụ âm: -습니다; sau nguyên âm: -ㅂ니다.', ex: [['저는 학생입니다.', 'Tôi là học sinh.'], ['감사합니다.', 'Xin cảm ơn.']] }),
    FIN('-ㅂ니까/습니까', 'f', 'ㅂ니까|습니까', 'đuôi câu hỏi lịch sự, trang trọng', { style: 'câu hỏi, trang trọng' },
      { strong: true, lvl: 'hapsyo', sent: 'ques', lv: 1, ex: [['어디에 갑니까?', 'Anh đi đâu vậy ạ?']] }),
    FIN('-(으)십시오', 'u', '십시오', 'mệnh lệnh / đề nghị trang trọng, kính ngữ', { style: 'trang trọng, kính ngữ' },
      { strong: true, lvl: 'hapsyo', sent: 'imper', lv: 1, ex: [['앉으십시오.', 'Xin mời ngồi.']] }),
    FIN('-(으)ㅂ시다', 'u', 'ㅂ시다', 'đề nghị “chúng ta hãy…” (trang trọng)', { style: 'đề nghị' },
      { strong: true, lvl: 'hapsyo', sent: 'prop', lv: 2, ex: [['같이 갑시다.', 'Chúng ta cùng đi nào.']] }),
    FIN('-ㅂ디다/습디다', 'f', 'ㅂ디다|습디다', 'kể lại điều mình đã thấy / đã nghe “(tôi thấy) … đấy” (trang trọng, hơi cũ)', { post: '(hồi tưởng)', style: 'trang trọng' },
      { strong: true, lvl: 'hapsyo', sent: 'decl', lv: 5 }),
    FIN('-ㅂ디까/습디까', 'f', 'ㅂ디까|습디까', 'hỏi lại điều đã thấy / đã nghe “… thế à?” (trang trọng, hơi cũ)', { post: '(hồi tưởng)', style: 'câu hỏi, trang trọng' },
      { strong: true, lvl: 'hapsyo', sent: 'ques', lv: 5 }),
    // ---- 해요체 (informal polite) ---------------------------------------------------------------------
    FIN('-아요/어요', 'a', '요', 'đuôi câu lịch sự, thân mật', { style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'decl', lv: 1, note: 'Mức lịch sự thông dụng nhất trong hội thoại hằng ngày. Câu trần thuật, câu hỏi, mệnh lệnh và rủ rê đều cùng một hình thức; ngữ điệu quyết định.', ex: [['한국어를 공부해요.', 'Tôi học tiếng Hàn.'], ['지금 뭐 해요?', 'Bây giờ bạn đang làm gì?']] }),
    FIN('-(으)세요', 'u', '세요', 'đuôi câu lịch sự, kính ngữ (đề nghị / hỏi / nói)', { style: 'kính ngữ, lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'imper', lv: 1, note: '-(으)시- + -어요. Đề nghị lịch sự (“hãy …”), hoặc hỏi / nói về người đáng kính.', ex: [['여기 앉으세요.', 'Mời ngồi đây.']] }),
    FIN('-(으)ㄹ까요', 'u', 'ㄹ까요', 'hỏi ý / phỏng đoán “…nhé? / liệu … không?”', { style: 'lịch sự, đề nghị' },
      { strong: true, lvl: 'haeyo', sent: 'ques', lv: 1, ex: [['같이 갈까요?', 'Chúng ta cùng đi nhé?']] }),
    FIN('-(으)ㄹ게요', 'u', 'ㄹ게요', 'hứa / quyết định “tôi sẽ …”', { pre: 'sẽ', style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'intent', lv: 2, ex: [['제가 할게요.', 'Để tôi làm.']] }),
    FIN('-(으)ㄹ래요', 'u', 'ㄹ래요', 'ý định / hỏi ý “muốn … / … nhé?”', { pre: 'muốn', style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'intent', lv: 2 }),
    FIN('-(으)ㄹ걸요', 'u', 'ㄹ걸요', 'phỏng đoán “chắc là … đấy”', { pre: 'chắc là', style: 'lịch sự' },
      { lvl: 'haeyo', sent: 'guess', lv: 3 }),
    FIN('-(으)ㄹ텐데요', 'u', 'ㄹ텐데요', '“chắc là … đấy (mà)” (suy đoán + lo lắng / mong đợi)', { pre: 'chắc là', style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'guess', lv: 3 }),
    FIN('-네요', 'c', '네요', 'nhận ra điều mới “ra là … nhỉ” (lịch sự)', { style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'excl', lv: 2, ex: [['한국어를 잘하시네요!', 'Bạn nói tiếng Hàn giỏi quá!']] }),
    FIN('-군요', 'c', '군요', 'thốt lên khi nhận ra “thì ra … (lịch sự)”', { style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'excl', lv: 2 }),
    FIN('-는군요', 'c', '는군요', 'thốt lên khi nhận ra “thì ra … (lịch sự)”', { style: 'lịch sự' }, { strong: true, bare: 'v', lvl: 'haeyo', sent: 'excl', lv: 2 }),
    FIN('-거든요', 'c', '거든요', 'giải thích “vì … mà”', { style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'decl', lv: 2, note: 'Đưa ra lý do / thông tin nền mà người nghe chưa biết, thường để giải thích cho điều vừa nói.', ex: [['요즘 너무 바빠요. 시험이 있거든요.', 'Dạo này tôi bận lắm. Vì có kỳ thi mà.']] }),
    FIN('-잖아요', 'c', '잖아요', 'nhắc điều đã biết “… mà / … đấy”', { style: 'lịch sự' },
      { strong: true, lvl: 'haeyo', sent: 'decl', lv: 2, note: 'Rút gọn của -지 않아요: nhắc điều người nghe đã biết hoặc nên biết.', ex: [['어제 말했잖아요.', 'Hôm qua tôi đã nói rồi mà.']] }),
    FIN('-나요', 'c', '나요', 'hỏi nhẹ nhàng “… không ạ?”', { style: 'câu hỏi, lịch sự' }, { lvl: 'haeyo', sent: 'ques', lv: 2 }),
    FIN('-(으)ㄴ가요', 'u', 'ㄴ가요', 'hỏi nhẹ nhàng “… không ạ?”', { style: 'câu hỏi, lịch sự' }, { bare: 'adj', needsBare: true, lvl: 'haeyo', sent: 'ques', lv: 2 }),
    FIN('-는가요', 'c', '는가요', 'hỏi nhẹ nhàng “… không ạ?”', { style: 'câu hỏi, lịch sự' }, { bare: 'v', lvl: 'haeyo', sent: 'ques', lv: 3 }),
    FIN('-던가요', 'c', '던가요', 'hỏi về điều đã xảy ra “… không ạ? / … hả?”', { style: 'câu hỏi, lịch sự' }, { lvl: 'haeyo', sent: 'ques', lv: 4 }),
    FIN('-지요', 'c', '지요', 'đuôi câu “nhỉ / đúng không / dĩ nhiên” (lịch sự)', { style: 'lịch sự' }, { strong: true, lvl: 'haeyo', sent: 'decl', lv: 2 }),
    FIN('-죠', 'c', '죠', 'đuôi câu “nhỉ / đúng không / dĩ nhiên” (lịch sự, rút gọn của -지요)', { style: 'lịch sự' }, { strong: true, lvl: 'haeyo', sent: 'decl', lv: 2 }),

    FIN('-더군요', 'c', '더군요', 'thốt lên khi nhớ lại điều đã thấy “(tôi thấy) … đấy” (lịch sự)', { post: '(hồi tưởng)', style: 'lịch sự' }, { strong: true, lvl: 'haeyo', sent: 'excl', lv: 4 }),
    FIN('-구먼요', 'c', '구먼요', 'thốt lên khi nhận ra “… đấy / … nhỉ” (lịch sự, khẩu ngữ)', { style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl', lv: 5 }),
    FIN('-(으)ㄴ걸요', 'u', 'ㄴ걸요', 'nhận xét / phản bác nhẹ “… đấy chứ” (lịch sự)', { style: 'lịch sự' }, { bare: 'adj', needsBare: true, lvl: 'haeyo', sent: 'excl', lv: 4 }),
    FIN('-는걸요', 'c', '는걸요', 'nhận xét / phản bác nhẹ “… đấy chứ” (lịch sự)', { style: 'lịch sự' }, { bare: 'v', lvl: 'haeyo', sent: 'excl', lv: 4 }),
    FIN('-던걸요', 'c', '던걸요', 'nhận xét về điều đã thấy “… đấy chứ” (lịch sự)', { post: '(hồi tưởng)', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl', lv: 5 }),
    FIN('-아야지요/어야지요', 'a', '야지요', 'phải … chứ (lịch sự)', { pre: 'phải', style: 'lịch sự' }, { strong: true, lvl: 'haeyo', sent: 'decl', lv: 3 }),
    FIN('-아야죠/어야죠', 'a', '야죠', 'phải … chứ (lịch sự)', { pre: 'phải', style: 'lịch sự' }, { strong: true, lvl: 'haeyo', sent: 'decl', lv: 3 }),
    // ---- 해체 (banmal, intimate) ----------------------------------------------------------------------
    FIN('-아/어', 'a', '', 'đuôi câu thân mật (nói với bạn bè / người nhỏ tuổi) hoặc dạng nối', { style: 'thân mật' }, { lvl: 'hae', sent: 'decl', lv: 1 }),
    FIN('-지', 'c', '지', 'đuôi câu “nhỉ / chứ” (thân mật)', { style: 'thân mật' }, { lvl: 'hae', sent: 'decl', lv: 2 }),
    FIN('-(으)ㄹ까', 'u', 'ㄹ까', 'hỏi ý / tự hỏi “…nhé? / liệu … không?”', { style: 'thân mật' }, { lvl: 'hae', sent: 'ques', lv: 1 }),
    FIN('-(으)ㄹ게', 'u', 'ㄹ게', 'hứa / quyết định “tôi sẽ …”', { pre: 'sẽ', style: 'thân mật' }, { lvl: 'hae', sent: 'intent', lv: 2 }),
    FIN('-(으)ㄹ래', 'u', 'ㄹ래', 'ý định / hỏi ý “muốn … / … nhé?”', { pre: 'muốn', style: 'thân mật' }, { lvl: 'hae', sent: 'intent', lv: 2 }),
    FIN('-(으)ㄹ걸', 'u', 'ㄹ걸', 'phỏng đoán “chắc là … đấy” / tiếc nuối', { pre: 'chắc là', style: 'thân mật' }, { lvl: 'hae', sent: 'guess', lv: 3 }),
    FIN('-(으)ㄹ텐데', 'u', 'ㄹ텐데', '“chắc là … (mà)” (suy đoán + lo lắng / mong đợi)', { pre: 'chắc là', style: 'thân mật' }, { strong: true, lvl: 'hae', sent: 'guess', lv: 3 }),
    FIN('-네', 'c', '네', 'nhận ra điều mới “ra là … nhỉ” (thân mật)', { style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 2 }),
    FIN('-군', 'c', '군', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 2 }),
    FIN('-는군', 'c', '는군', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }, { bare: 'v', lvl: 'hae', sent: 'excl', lv: 3 }),
    FIN('-는구나', 'c', '는구나', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }, { bare: 'v', lvl: 'hae', sent: 'excl', lv: 3 }),
    FIN('-구나', 'c', '구나', 'thốt lên khi nhận ra “thì ra …”', { style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 3 }),
    FIN('-거든', 'c', '거든', 'giải thích “vì … mà” / điều kiện', { style: 'thân mật' }, { lvl: 'hae', sent: 'decl', lv: 2 }),
    FIN('-잖아', 'c', '잖아', 'nhắc điều đã biết “… mà / … đấy”', { style: 'thân mật' }, { lvl: 'hae', sent: 'decl', lv: 2 }),
    FIN('-잖니', 'c', '잖니', 'nhắc điều đã biết “… mà / … chứ” (hỏi thân mật)', { style: 'thân mật' }, { lvl: 'haera', sent: 'ques', lv: 4 }),
    FIN('-잖나', 'c', '잖나', 'nhắc điều đã biết “… mà / … chứ” (hơi cũ)', { style: 'kiểu cổ' }, { lvl: 'hage', sent: 'ques', lv: 5 }),
    FIN('-잖소', 'c', '잖소', 'nhắc điều đã biết “… mà” (kiểu cổ, 하오체)', { style: 'kiểu cổ (하오체)' }, { lvl: 'hao', sent: 'decl', lv: 5 }),
    FIN('-나봐', 'c', '나봐', 'hình như … (phỏng đoán từ những gì thấy)', { pre: 'hình như', style: 'thân mật' }, { yo: true, lvl: 'hae', sent: 'guess', lv: 3 }),
    FIN('-(으)ㄴ가봐', 'u', 'ㄴ가봐', 'hình như … (phỏng đoán từ những gì thấy)', { pre: 'hình như', style: 'thân mật' }, { bare: 'adj', needsBare: true, yo: true, lvl: 'hae', sent: 'guess', lv: 3 }),
    FIN('-자꾸나', 'c', '자꾸나', 'rủ rê “… nào” (thân mật, giọng người lớn)', { style: 'thân mật' }, { lvl: 'haera', sent: 'prop', lv: 5 }),
    FIN('-(으)소서', 'u', '소서', 'xin hãy … (cầu nguyện, kính cẩn)', { pre: 'xin hãy', style: 'kính cẩn' }, { lvl: 'hapsyo', sent: 'imper', lv: 6 }),
    FIN('-더라', 'c', '더라', 'hồi tưởng “(tôi thấy) hóa ra …”', { post: '(hồi tưởng)', style: 'thân mật' }, { lvl: 'hae', sent: 'decl', lv: 3 }),
    FIN('-더라고', 'c', '더라고', 'hồi tưởng “(tôi thấy) hóa ra …”', { post: '(hồi tưởng)', style: 'thân mật' }, { strong: true, yo: true, lvl: 'hae', sent: 'decl', lv: 3 }),
    FIN('-더군', 'c', '더군', 'thốt lên khi nhớ lại điều đã thấy “(tôi thấy) … đấy”', { post: '(hồi tưởng)', style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 4 }),
    FIN('-더구나', 'c', '더구나', 'thốt lên khi nhớ lại điều đã thấy “(tôi thấy) … đấy”', { post: '(hồi tưởng)', style: 'thân mật' }, { lvl: 'haera', sent: 'excl', lv: 4 }),
    FIN('-구먼', 'c', '구먼', 'thốt lên khi nhận ra “… đấy / … nhỉ” (khẩu ngữ, người lớn tuổi)', { style: 'thân mật' }, { lvl: 'hage', sent: 'excl', lv: 5 }),
    FIN('-구만', 'c', '구만', 'thốt lên khi nhận ra “… đấy / … nhỉ” (khẩu ngữ)', { style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 5 }),
    FIN('-나', 'c', '나', 'hỏi / tự hỏi “… không nhỉ?” (thân mật)', { style: 'câu hỏi, thân mật' }, { lvl: 'hae', sent: 'ques', lv: 3 }),
    FIN('-(으)ㄴ가', 'u', 'ㄴ가', 'hỏi / tự hỏi “… không nhỉ?”', { style: 'câu hỏi, thân mật' }, { bare: 'adj', needsBare: true, lvl: 'hae', sent: 'ques', lv: 3 }),
    FIN('-는가', 'c', '는가', 'hỏi / tự hỏi “… không?”', { style: 'câu hỏi' }, { bare: 'v', lvl: 'hage', sent: 'ques', lv: 4 }),
    FIN('-던가', 'c', '던가', 'hỏi về điều đã xảy ra “… không nhỉ?”', { style: 'câu hỏi, thân mật' }, { lvl: 'hae', sent: 'ques', lv: 4 }),
    FIN('-(으)ㄴ걸', 'u', 'ㄴ걸', 'nhận xét / phản bác nhẹ “… đấy chứ”', { style: 'thân mật' }, { bare: 'adj', needsBare: true, lvl: 'hae', sent: 'excl', lv: 4 }),
    FIN('-는걸', 'c', '는걸', 'nhận xét / phản bác nhẹ “… đấy chứ”', { style: 'thân mật' }, { bare: 'v', lvl: 'hae', sent: 'excl', lv: 4 }),
    FIN('-던걸', 'c', '던걸', 'nhận xét về điều đã thấy “… đấy chứ”', { post: '(hồi tưởng)', style: 'thân mật' }, { lvl: 'hae', sent: 'excl', lv: 5 }),
    FIN('-아야지/어야지', 'a', '야지', 'phải … chứ (tự nhắc / nhắc người khác)', { pre: 'phải', style: 'thân mật' }, { strong: true, lvl: 'hae', sent: 'decl', lv: 3 }),
    FIN('-(으)ㄹ라', 'u', 'ㄹ라', 'cảnh báo “coi chừng kẻo …” (thân mật)', { pre: 'coi chừng', style: 'thân mật' }, { lvl: 'hae', sent: 'imper', lv: 5 }),
    // ---- 해라체 (plain / written) ---------------------------------------------------------------------
    FIN('-다', 'c', '다', 'đuôi câu trần thuật (dạng từ điển / văn viết)', { style: 'văn viết' }, { lvl: 'haera', sent: 'decl', lv: 1 }),
    FIN('-ㄴ다/는다', 'f', 'ㄴ다|는다', 'đuôi câu trần thuật hiện tại (văn viết / thân mật)', { style: 'văn viết' }, { bare: 'v0', lvl: 'haera', sent: 'decl', lv: 2 }),
    FIN('-니', 'c', '니', 'câu hỏi thân mật “… à?”', { style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques', lv: 2 }),
    FIN('-냐', 'c', '냐', 'câu hỏi thân mật “… à?”', { style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques', lv: 2 }),
    FIN('-(으)냐', 'u', '냐', 'câu hỏi thân mật “… à?”', { style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques', lv: 2 }),
    FIN('-느냐', 'c', '느냐', 'câu hỏi “… à?” (văn viết / thân mật)', { style: 'câu hỏi' }, { bare: 'v', lvl: 'haera', sent: 'ques', lv: 4 }),
    FIN('-자', 'c', '자', 'đề nghị “hãy cùng … nào” (thân mật); nối: “ngay khi … thì”', { style: 'đề nghị, thân mật' }, { lvl: 'haera', sent: 'prop', lv: 1 }),
    FIN('-아라/어라', 'a', '라', 'mệnh lệnh thân mật', { style: 'mệnh lệnh' }, { lvl: 'haera', sent: 'imper', lv: 2 }),
    FIN('-(으)라', 'u', '라', 'mệnh lệnh (văn viết, chỉ dẫn)', { style: 'mệnh lệnh' }, { lvl: 'haera', sent: 'imper', lv: 4, not: ['아니'] }),
    FIN('-거라', 'c', '거라', 'mệnh lệnh nhẹ nhàng với người nhỏ tuổi', { style: 'mệnh lệnh nhẹ' }, { lvl: 'haera', sent: 'imper', lv: 4 }),
    FIN('-너라', 'c', '너라', 'mệnh lệnh “hãy đến” (đi với 오다)', { style: 'mệnh lệnh nhẹ' }, { lvl: 'haera', sent: 'imper', lv: 5 }),
    FIN('-(으)렴', 'u', '렴', 'lời khuyên / mệnh lệnh dịu dàng với người nhỏ tuổi', { style: 'mệnh lệnh nhẹ' }, { lvl: 'haera', sent: 'imper', lv: 5 }),
    FIN('-(으)려무나', 'u', '려무나', 'lời khuyên / cho phép dịu dàng “cứ … đi”', { style: 'mệnh lệnh nhẹ' }, { lvl: 'haera', sent: 'imper', lv: 5 }),
    FIN('-(으)마', 'u', '마', 'hứa “tôi sẽ …” (thân mật, với người nhỏ)', { pre: 'sẽ', style: 'thân mật' }, { lvl: 'haera', sent: 'intent', lv: 5 }),
    FIN('-(으)리라', 'u', '리라', 'quyết tâm / dự đoán “sẽ …” (văn viết)', { pre: 'sẽ', style: 'văn viết' }, { lvl: 'haera', sent: 'intent', lv: 6 }),
    FIN('-ㄴ단다/는단다', 'f', 'ㄴ단다|는단다', 'nghe nói / giải thích cho trẻ nhỏ “… đấy (con)”', { style: 'thân mật' }, { bare: 'v0', lvl: 'haera', sent: 'decl', lv: 4 }),
    FIN('-단다', 'c', '단다', 'nghe nói / giải thích cho trẻ nhỏ “… đấy (con)”', { style: 'thân mật' }, { bare: 'plain', lvl: 'haera', sent: 'decl', lv: 4 }),
    // ---- 하오체 / 하게체 (old-fashioned; seen in historical dramas and from older speakers) ----------------
    FIN('-(으)오/소', 'f', '오|소', 'đuôi câu kiểu cổ, trang trọng vừa phải (하오체)', { style: 'kiểu cổ (하오체)' }, { strong: true, lvl: 'hao', sent: 'decl', lv: 5, note: 'Hay gặp trong phim cổ trang hoặc lời người lớn tuổi nói với người ngang hàng: 있소, 없소, 좋소, 가오, 하오.' }),
    FIN('-(으)시오', 'u', '시오', 'mệnh lệnh / đề nghị kiểu cổ, kính ngữ (하오체)', { style: 'kiểu cổ (하오체)' }, { strong: true, lvl: 'hao', sent: 'imper', lv: 5 }),
    FIN('-구려', 'c', '구려', 'thốt lên khi nhận ra “… nhỉ” (하오체)', { style: 'kiểu cổ (하오체)' }, { lvl: 'hao', sent: 'excl', lv: 6 }),
    FIN('-(으)리다', 'u', '리다', 'quyết tâm “sẽ …” (kiểu cổ)', { pre: 'sẽ', style: 'kiểu cổ' }, { lvl: 'hao', sent: 'intent', lv: 6 }),
    FIN('-(으)ㅂ시오', 'u', 'ㅂ시오', 'mệnh lệnh / đề nghị kiểu cổ rất trang trọng', { style: 'kiểu cổ (rất trang trọng)' }, { lvl: 'hapsyo', sent: 'imper', lv: 6 }),
    FIN('-게나', 'c', '게나', 'mệnh lệnh nhẹ nhàng của người lớn với người nhỏ (하게체)', { style: 'kiểu cổ (하게체)' }, { lvl: 'hage', sent: 'imper', lv: 6 }),
    FIN('-세', 'c', '세', 'rủ rê kiểu cổ “… đi” (하게체)', { style: 'kiểu cổ (하게체)' }, { lvl: 'hage', sent: 'prop', lv: 6 }),
    FIN('-(으)ㄹ세', 'u', 'ㄹ세', 'khẳng định kiểu cổ “… đấy” (하게체)', { style: 'kiểu cổ (하게체)' }, { lvl: 'hage', sent: 'decl', lv: 6 }),
    // ====================================================================================================
    // 2. CONNECTIVE ENDINGS (clause linkers), by relation
    // ====================================================================================================
    // ---- sequence / list -------------------------------------------------------------------------------
    CON('-고', 'c', '고', 'và / rồi (nối hành động, liệt kê)', { post: 'và' }, { yo: true, rel: 'seq', lv: 1, note: 'Nối hai hành động theo thứ tự hoặc liệt kê hai sự việc.', ex: [['밥을 먹고 학교에 가요.', 'Ăn cơm rồi đi học.']] }),
    CON('-고서', 'c', '고서', 'sau khi … thì (hành động trước hoàn tất rồi mới đến hành động sau)', { post: 'rồi thì' }, { yo: true, rel: 'seq', lv: 3 }),
    CON('-고는', 'c', '고는', '… rồi thì (thường dẫn đến kết quả đối lập / không tốt)', { post: 'rồi thì' }, { yo: true, rel: 'seq', lv: 4 }),
    CON('-고도', 'c', '고도', 'đã … mà vẫn / … rồi mà còn', { post: 'mà vẫn' }, { yo: true, rel: 'conc', lv: 4 }),
    CON('-아서/어서', 'a', '서', 'nên / rồi thì (nguyên nhân, trình tự)', { post: 'nên' }, { strong: true, yo: true, rel: 'cause', lv: 1, note: 'Nguyên nhân (…nên…) hoặc trình tự gắn liền (đi rồi mua). Không dùng thì quá khứ/tương lai trước -서; không dùng cho mệnh lệnh / rủ rê ở vế sau.', ex: [['비가 와서 집에 있었어요.', 'Vì trời mưa nên tôi ở nhà.']] }),
    CON('-아다/어다', 'a', '다', 'làm xong rồi mang / đưa (đến chỗ khác)', { post: 'rồi mang' }, { rel: 'seq', lv: 4 }),
    CON('-아다가/어다가', 'a', '다가', 'làm xong rồi mang / đưa (đến chỗ khác)', { post: 'rồi mang' }, { yo: true, rel: 'seq', lv: 4 }),
    CON('-다가', 'c', '다가', 'đang … thì (chuyển sang hành động khác)', { post: 'đang … thì' }, { yo: true, rel: 'seq', lv: 2 }),
    CON('-다가는', 'c', '다가는', 'cứ … thì (sẽ có kết quả xấu)', { post: 'cứ thế thì' }, { rel: 'cond', lv: 4 }),
    CON('-다간', 'c', '다간', 'cứ … thì (sẽ có kết quả xấu) (rút gọn của -다가는)', { post: 'cứ thế thì' }, { rel: 'cond', lv: 4 }),
    CON('-자마자', 'c', '자마자', 'vừa … là', { post: 'vừa … là' }, { rel: 'imm', lv: 2 }),
    CON('-(으)며', 'u', '며', 'và / vừa … vừa (văn viết)', { post: 'và' }, { yo: true, rel: 'list', lv: 3 }),
    CON('-(으)면서', 'u', '면서', 'vừa … vừa', { post: '(vừa … vừa)' }, { rel: 'simul', lv: 2, yo: true }),
    CON('-(으)면서도', 'u', '면서도', 'vừa … mà vẫn / dù … mà vẫn', { post: 'mà vẫn' }, { rel: 'conc', lv: 4 }),
    CON('-곤', 'c', '곤', '… rồi thì / hay … (rút gọn của -고는; -곤 하다 = hay …)', { post: 'rồi thì' }, { rel: 'seq', lv: 4 }),
    CON('-고서야', 'c', '고서야', '… rồi mới (mãi đến khi …)', { post: 'rồi mới' }, { rel: 'cond', lv: 5 }),
    CON('-더니', 'c', '더니', '“… rồi thì” (đã thấy / đã trải qua)', { post: 'rồi thì' }, { rel: 'seq', lv: 4, yo: true }),
    CON('-더니만', 'c', '더니만', '“… rồi thì” (nhấn mạnh, kết quả bất ngờ)', { post: 'rồi thì' }, { rel: 'seq', lv: 5 }),
    // ---- cause / reason --------------------------------------------------------------------------------
    CON('-(으)니까', 'u', '니까', 'vì … (nên)', { pre: 'vì' }, { strong: true, yo: true, rel: 'cause', lv: 1, note: 'Lý do chủ quan; dùng được với mệnh lệnh / rủ rê ở vế sau, và với thì quá khứ.', ex: [['추우니까 옷을 입으세요.', 'Trời lạnh nên hãy mặc áo vào.']] }),
    CON('-(으)니', 'u', '니', 'vì / khi … thì (phát hiện, lý do)', { pre: 'khi' }, { rel: 'cause', lv: 4 }),
    CON('-(으)므로', 'u', '므로', 'vì … nên (trang trọng / văn viết)', { pre: 'vì' }, { rel: 'cause', lv: 5 }),
    CON('-느라고', 'c', '느라고', 'vì mải …', { pre: 'vì mải' }, { rel: 'cause', lv: 3, yo: true }),
    CON('-느라', 'c', '느라', 'vì mải … (rút gọn)', { pre: 'vì mải' }, { rel: 'cause', lv: 3 }),
    CON('-기에', 'c', '기에', 'vì … nên (nghe nói / thấy) / để …', { pre: 'vì' }, { rel: 'cause', lv: 5 }),
    CON('-길래', 'c', '길래', 'vì … nên (hỏi / nói lý do của hành động vừa rồi)', { pre: 'vì' }, { yo: true, rel: 'cause', lv: 5 }),
    // ---- condition --------------------------------------------------------------------------------------
    CON('-(으)면', 'u', '면', 'nếu / khi', { pre: 'nếu' }, { strong: true, yo: true, rel: 'cond', lv: 1, ex: [['시간이 있으면 전화하세요.', 'Nếu có thời gian thì hãy gọi điện.']] }),
    CON('-(으)면은', 'u', '면은', 'nếu / khi (nhấn mạnh)', { pre: 'nếu' }, { rel: 'cond', lv: 3 }),
    CON('-(으)려면', 'u', '려면', 'nếu định / muốn … thì', { pre: 'nếu định' }, { strong: true, yo: true, rel: 'cond', lv: 3 }),
    CON('-자면', 'c', '자면', 'nếu muốn … thì / nói về chuyện … thì', { pre: 'nếu muốn' }, { rel: 'cond', lv: 4 }),
    CON('-아서는/어서는', 'a', '서는', 'cứ … thì (không tốt) / nếu … thì (phủ định ở vế sau)', { post: 'thì' }, { rel: 'cond', lv: 4 }),
    CON('-아선/어선', 'a', '선', 'cứ … thì (rút gọn của -아서는/어서는)', { post: 'thì' }, { rel: 'cond', lv: 4 }),
    CON('-아서야/어서야', 'a', '서야', 'phải … rồi mới / mãi đến khi …', { post: 'rồi mới' }, { rel: 'cond', lv: 5 }),
    CON('-아야만/어야만', 'a', '야만', 'chỉ khi … mới / phải … mới', { pre: 'chỉ khi' }, { rel: 'cond', lv: 4 }),
    CON('-아야/어야', 'a', '야', 'phải … mới', { pre: 'phải' }, { strong: true, yo: true, rel: 'cond', lv: 3 }),
    CON('-더라면', 'c', '더라면', 'giá mà … thì (giả định trái với quá khứ)', { pre: 'giá mà' }, { rel: 'cond', lv: 5 }),
    // ---- concession / contrast ---------------------------------------------------------------------------
    CON('-지만', 'c', '지만', 'nhưng', { post: 'nhưng' }, { strong: true, yo: true, rel: 'contrast', lv: 1 }),
    CON('-진', 'c', '진', '-지 + 는 rút gọn (… thì: 하진 않아요 = làm thì không làm)', { paren: 'nhấn mạnh' }, { rel: 'seq', lv: 3 }),
    CON('-질', 'c', '질', '-지 + 를 rút gọn (… : 믿기질 않아요 = khó mà tin được)', { paren: 'nhấn mạnh' }, { rel: 'seq', lv: 4 }),
    CON('-(으)나', 'u', '나', 'nhưng (văn viết) / dù … hay …', { post: 'nhưng' }, { rel: 'contrast', lv: 4 }),
    CON('-건만', 'c', '건만', 'dù … nhưng (văn viết)', { pre: 'dù' }, { rel: 'contrast', lv: 6 }),
    CON('-던데', 'c', '던데', 'đã thấy / nghe … mà (kể điều đã trải qua, nêu bối cảnh)', { post: '(hồi tưởng) mà' }, { yo: true, rel: 'bg', lvl: 'hae', sent: 'decl', lv: 4 }),
    CON('-는데', 'c', '는데', 'nhưng / và (dẫn dắt, nói bối cảnh)', { post: 'nhưng / và' }, { bare: 'v', yo: true, rel: 'bg', lvl: 'hae', sent: 'decl', lv: 2, note: 'Đưa ra bối cảnh / hoàn cảnh cho vế sau; tùy ngữ cảnh mang nghĩa “nhưng”, “và”, “nên”.' }),
    CON('-(으)ㄴ데', 'u', 'ㄴ데', 'nhưng / và (dẫn dắt, nói bối cảnh)', { post: 'nhưng / và' }, { bare: 'adj', needsBare: true, yo: true, rel: 'bg', lvl: 'hae', sent: 'decl', lv: 2 }),
    CON('-는데도', 'c', '는데도', 'mặc dù … vẫn', { pre: 'mặc dù' }, { bare: 'v', yo: true, rel: 'conc', lv: 4 }),
    CON('-(으)ㄴ데도', 'u', 'ㄴ데도', 'mặc dù … vẫn', { pre: 'mặc dù' }, { bare: 'adj', needsBare: true, yo: true, rel: 'conc', lv: 4 }),
    CON('-아도/어도', 'a', '도', 'dù … cũng', { pre: 'dù' }, { yo: true, rel: 'conc', lv: 2 }),
    CON('-더라도', 'c', '더라도', 'cho dù … đi nữa', { pre: 'cho dù' }, { yo: true, rel: 'conc', lv: 4 }),
    CON('-(으)ㄹ지라도', 'u', 'ㄹ지라도', 'cho dù … đi nữa (nhấn mạnh)', { pre: 'cho dù' }, { rel: 'conc', lv: 5 }),
    CON('-(으)ㄹ망정', 'u', 'ㄹ망정', 'thà … chứ không / dù có … thì', { pre: 'dù có' }, { rel: 'conc', lv: 6 }),
    CON('-(으)ㄹ지언정', 'u', 'ㄹ지언정', 'thà … chứ không / dù có … thì', { pre: 'dù có' }, { rel: 'conc', lv: 6 }),
    CON('-(으)ㄴ들', 'u', 'ㄴ들', 'dù có … thì cũng (không ích gì)', { pre: 'dù có' }, { rel: 'conc', lv: 6 }),
    // ---- purpose / intent / manner ----------------------------------------------------------------------
    CON('-(으)러', 'u', '러', 'để (đi / đến để làm gì)', { pre: 'để' }, { yo: true, rel: 'purpose', lv: 1 }),
    CON('-(으)려고', 'u', '려고', 'định / để (mục đích)', { pre: 'định' }, { strong: true, yo: true, rel: 'purpose', lv: 2 }),
    CON('-(으)려', 'u', '려', 'định / để (mục đích; dạng ngắn)', { pre: 'định' }, { rel: 'purpose', lv: 3 }),
    CON('-도록', 'c', '도록', 'để / cho đến khi', { pre: 'để' }, { rel: 'purpose', lv: 3, yo: true }),
    CON('-게', 'c', '게', 'một cách … / để …', { post: '(trạng từ)' }, { yo: true, rel: 'manner', lv: 2 }),
    CON('-게끔', 'c', '게끔', 'để cho … (mục đích, nhấn mạnh)', { pre: 'để cho' }, { rel: 'purpose', lv: 5 }),
    CON('-고자', 'c', '고자', 'để / nhằm … (trang trọng)', { pre: 'để' }, { rel: 'purpose', lv: 4 }),
    CON('-기로', 'c', '기로', 'quyết định / hẹn … (đi với 하다, 결정하다, 약속하다 …)', { pre: 'quyết định' }, { rel: 'intent', lv: 3 }),
    // ---- alternatives, degree ---------------------------------------------------------------------------
    CON('-거나', 'c', '거나', 'hoặc', { post: 'hoặc' }, { rel: 'alt', lv: 2, yo: true }),
    CON('-든지', 'c', '든지', 'hoặc / dù … hay …', { post: 'hoặc' }, { rel: 'alt', lv: 3, yo: true }),
    CON('-든', 'c', '든', 'dù … hay … (rút gọn của -든지)', { post: 'hay' }, { rel: 'alt', lv: 3 }),
    CON('-느니', 'c', '느니', 'thà … còn hơn (… 느니 차라리)', { pre: 'thà' }, { rel: 'alt', lv: 5 }),
    CON('-(으)ㄹ수록', 'u', 'ㄹ수록', 'càng … càng', { pre: 'càng' }, { rel: 'degree', lv: 3, yo: true }),
    CON('-다시피', 'c', '다시피', 'như (bạn) … (알다시피 = như bạn đã biết)', { pre: 'như' }, { rel: 'manner', lv: 5 }),
    CON('-듯이', 'c', '듯이', 'như thể / giống như …', { pre: 'như' }, { rel: 'manner', lv: 4 }),
    CON('-듯', 'c', '듯', 'như thể / giống như …', { pre: 'như' }, { rel: 'manner', lv: 5 }),
    // ---- indirect questions ----------------------------------------------------------------------------
    CON('-(으)ㄹ지', 'u', 'ㄹ지', '“liệu … hay không”', { post: '(liệu)' }, { yo: true, rel: 'quote', lv: 3 }),
    CON('-는지', 'c', '는지', '“liệu … hay không”', { post: '(liệu)' }, { bare: 'v', yo: true, rel: 'quote', lv: 3 }),
    CON('-(으)ㄴ지', 'u', 'ㄴ지', '“liệu … hay không” / “kể từ khi”', { post: '(liệu)' }, { yo: true, rel: 'quote', lv: 3 }),
    CON('-(으)ㄹ지도', 'u', 'ㄹ지도', 'biết đâu / có lẽ … (-(으)ㄹ지도 모르다)', { pre: 'biết đâu' }, { rel: 'quote', lv: 4 }),
    CON('-는지도', 'c', '는지도', 'không biết có … nữa / có khi … (-는지도 모르다)', { post: '(biết đâu)' }, { bare: 'v', rel: 'quote', lv: 4 }),
    CON('-(으)ㄴ지도', 'u', 'ㄴ지도', 'không biết có … nữa / có khi … (-(으)ㄴ지도 모르다)', { post: '(biết đâu)' }, { rel: 'quote', lv: 4 }),
    CON('-(으)ㄹ까봐', 'u', 'ㄹ까봐', 'vì sợ / lo rằng … nên', { pre: 'sợ rằng' }, { strong: true, yo: true, rel: 'cause', lv: 3 }),
    // ---- reported speech (direct → indirect) ---------------------------------------------------------------
    CON('-다고', 'c', '다고', 'trích dẫn gián tiếp “nói rằng …”', { post: '(trích dẫn)' }, { yo: true, bare: 'plain', rel: 'quote', lv: 3, note: 'Trích lời nói thuật lại: -다고 하다 (nói rằng …), -다고 생각하다 (nghĩ rằng …).' }),
    CON('-ㄴ다고/는다고', 'f', 'ㄴ다고|는다고', 'trích dẫn gián tiếp “nói rằng …”', { post: '(trích dẫn)' }, { yo: true, bare: 'v0', rel: 'quote', lv: 3 }),
    CON('-냐고', 'c', '냐고', 'trích dẫn câu hỏi “hỏi rằng …”', { post: '(trích dẫn)' }, { yo: true, rel: 'quote', lv: 3 }),
    CON('-자고', 'c', '자고', 'trích dẫn đề nghị “rủ rằng …”', { post: '(trích dẫn)' }, { yo: true, rel: 'quote', lv: 3 }),
    CON('-(으)라고', 'u', '라고', 'trích dẫn mệnh lệnh “bảo rằng hãy …”', { post: '(trích dẫn)' }, { yo: true, rel: 'quote', lv: 3 }),
    // ---- endings that exist only for 아니다 (the copula-like -라- family): 아니라서, 아니라면, 아니라고 ... -------------
    CON('-라', 'c', '라', 'không phải … mà (là) …', { post: '(mà là …)' }, { only: ['아니'], rel: 'contrast', lv: 2,
      note: '“A이/가 아니라 B” = “không phải A mà là B”. Dạng nối của 아니다.', ex: [['이것은 사과가 아니라 배예요.', 'Đây không phải táo mà là lê.']] }),
    CON('-라서', 'c', '라서', 'vì không phải là …', { pre: 'vì' }, { only: ['아니'], yo: true, rel: 'cause', lv: 3 }),
    CON('-라면', 'c', '라면', 'nếu không phải là …', { pre: 'nếu' }, { only: ['아니'], yo: true, rel: 'cond', lv: 3 }),
    CON('-라고', 'c', '라고', '(nói) không phải là …', { post: '(trích dẫn)' }, { only: ['아니'], yo: true, rel: 'quote', lv: 3 }),
    CON('-라며', 'c', '라며', 'nghe nói không phải là … (xác nhận lại)', { post: '(trích dẫn)' }, { only: ['아니'], yo: true, rel: 'quote', lv: 5 }),
    CON('-라니', 'c', '라니', 'không phải là … ư (ngạc nhiên)', { post: '(ngạc nhiên)' }, { only: ['아니'], yo: true, rel: 'quote', lv: 5 }),
    FIN('-란다', 'c', '란다', 'nghe nói không phải … đấy (con)', { pre: 'nghe nói', style: 'thân mật' }, { only: ['아니'], lvl: 'haera', sent: 'decl', lv: 5 }),
    // ====================================================================================================
    // 3. NOMINALIZERS AND ADNOMINALS
    // ====================================================================================================
    E('-기', 'c', '기', 'nominalizer', 'danh từ hóa: “việc …”', { pre: 'việc' }, { lv: 2 }),
    E('-(으)ㅁ', 'u', 'ㅁ', 'nominalizer', 'danh từ hóa: “việc …”', { pre: 'việc' }, { lv: 4 }),
    ADN('-(으)ㄴ', 'u', 'ㄴ', 'định ngữ (bổ nghĩa cho danh từ đứng sau)', { paren: 'định ngữ' },
      { needsBare: true, lv: 2, byPos: { v: { label: 'định ngữ quá khứ (… đã …)', compose: { pre: 'đã', paren: 'định ngữ' } }, adj: {} } }),
    ADN('-는', 'c', '는', 'định ngữ hiện tại (… đang …)', { paren: 'định ngữ' }, { bare: 'v', lv: 2 }),
    ADN('-(으)ㄹ', 'u', 'ㄹ', 'định ngữ tương lai / dự đoán (… sẽ …)', { pre: 'sẽ', paren: 'định ngữ' }, { lv: 2 }),
    ADN('-던', 'c', '던', 'định ngữ hồi tưởng (… đã từng …)', { pre: 'đã từng', paren: 'định ngữ' }, { lv: 3 }),
    ADN('-(으)려는', 'u', '려는', 'định ngữ “định …, sắp …”', { pre: 'định', paren: 'định ngữ' }, { lv: 4 }),
    ADN('-(으)려던', 'u', '려던', 'định ngữ “đã định …, đang định …”', { pre: 'đã định', paren: 'định ngữ' }, { lv: 4 }),
    ADN('-라는', 'c', '라는', 'định ngữ trích dẫn “không phải là …”', { paren: 'định ngữ trích dẫn' }, { only: ['아니'], lv: 4 }),
  ];

  // ---- reported-speech families, generated -------------------------------------------------------------
  // Direct speech -> indirect: statements -(ㄴ/는)다고, questions -냐고, proposals -자고, commands -(으)라고, plus the many
  // forms built on them (-다면, -다니까, -다며, -다는 ...) and the contracted "-다고 해" forms (-대, -래, -재, -냬).
  // [id suffix, text suffix, kind, label, compose, extra opts]
  const QUOTE_X = [
    ['면', '면', 'connective', 'nếu (giả sử) …', { pre: 'nếu' }, { rel: 'cond', lv: 4, yo: true }],
    ['니까', '니까', 'connective', '(tôi đã bảo là) … mà / vì bảo là …', { post: '(đã bảo là … mà)' }, { rel: 'cause', lv: 4, yo: true }],
    ['며', '며', 'connective', 'nghe nói … (xác nhận lại) / … thì bảo là …', { pre: 'nghe nói' }, { rel: 'quote', lv: 5, yo: true }],
    ['면서', '면서', 'connective', 'nghe nói … (xác nhận lại)', { pre: 'nghe nói' }, { rel: 'quote', lv: 5, yo: true }],
    ['길래', '길래', 'connective', 'vì nghe nói … nên', { pre: 'vì nghe nói' }, { rel: 'cause', lv: 5, yo: true }],
    ['기에', '기에', 'connective', 'vì nghe nói … nên', { pre: 'vì nghe nói' }, { rel: 'cause', lv: 6 }],
    ['던데', '던데', 'connective', 'nghe nói … mà', { pre: 'nghe nói' }, { rel: 'bg', lv: 5, yo: true }],
    ['더라', '더라', 'final', 'nghe nói … đấy (kể lại điều đã nghe)', { pre: 'nghe nói' }, { lvl: 'hae', sent: 'decl', lv: 5 }],
    ['니', '니', 'connective', '… ư? / lại … (ngạc nhiên)', { post: '(ngạc nhiên)' }, { rel: 'quote', lv: 4, yo: true, anyBare: true, note: 'Thốt lên khi ngạc nhiên hoặc không tin nổi: “하다니!” (làm như vậy sao!). Dạng -ㄴ다니/-는다니 dùng khi thuật lại lời người khác.' }],
    ['네', '네', 'final', 'nghe nói … đấy (khẩu ngữ)', { pre: 'nghe nói' }, { lvl: 'hae', sent: 'decl', lv: 5, yo: true }],
    ['는', '는', 'adnominal', 'định ngữ trích dẫn: “cái điều nói rằng …”', { paren: 'định ngữ trích dẫn' }, { lv: 4 }],
    ['던', '던', 'adnominal', 'định ngữ trích dẫn: “từng nói rằng …”', { paren: 'định ngữ trích dẫn' }, { lv: 5 }],
  ];
  function pushQuoteFamilies(out) {
    // statements: verbs take ㄴ다/는다, adjectives / tensed forms / 있다·없다 take -다
    for (const [sfx, text, kind, label, compose, o] of QUOTE_X) {
      out.push(E('-ㄴ다' + sfx + '/는다' + sfx, 'f', 'ㄴ다' + text + '|는다' + text, kind, label, compose, Object.assign({ bare: 'v0' }, o)));
      out.push(E('-다' + sfx, 'c', '다' + text, kind, label, compose, Object.assign(o.anyBare ? {} : { bare: 'plain' }, o)));
    }
    // contracted "-다고 해": -ㄴ대 / -대, -ㄴ답니다 / -답니다
    out.push(E('-ㄴ대/는대', 'f', 'ㄴ대|는대', 'final', 'nghe nói … (rút gọn của -다고 해)', { pre: 'nghe nói' }, { bare: 'v0', lvl: 'hae', sent: 'decl', lv: 4, yo: true }));
    out.push(E('-대', 'c', '대', 'final', 'nghe nói … (rút gọn của -다고 해)', { pre: 'nghe nói' }, { bare: 'plain', lvl: 'hae', sent: 'decl', lv: 4, yo: true }));
    out.push(E('-ㄴ답니다/는답니다', 'f', 'ㄴ답니다|는답니다', 'final', 'nghe nói … đấy ạ (rút gọn của -다고 합니다)', { pre: 'nghe nói', style: 'lịch sự' }, { bare: 'v0', lvl: 'hapsyo', sent: 'decl', lv: 5 }));
    out.push(E('-답니다', 'c', '답니다', 'final', 'nghe nói … đấy ạ (rút gọn của -다고 합니다)', { pre: 'nghe nói', style: 'lịch sự' }, { bare: 'plain', lvl: 'hapsyo', sent: 'decl', lv: 5 }));
    // contracted adnominals: 있단 (= 있다는), 간단 / 먹는단 (= 간다는 / 먹는다는), 하란 (= 하라는), 가잔 (= 가자는), 뭐냔 (= 뭐냐는)
    out.push(E('-단', 'c', '단', 'adnominal', 'định ngữ trích dẫn: “cái điều nói rằng …” (rút gọn của -다는)', { paren: 'định ngữ trích dẫn' }, { bare: 'plain', lv: 5 }));
    out.push(E('-ㄴ단/는단', 'f', 'ㄴ단|는단', 'adnominal', 'định ngữ trích dẫn: “cái điều nói rằng …” (rút gọn của -ㄴ다는/는다는)', { paren: 'định ngữ trích dẫn' }, { bare: 'v0', lv: 5 }));
    out.push(E('-란', 'u', '란', 'adnominal', 'định ngữ trích dẫn: “lời bảo rằng hãy …” (rút gọn của -(으)라는)', { paren: 'định ngữ trích dẫn' }, { lv: 5 }));
    out.push(E('-잔', 'c', '잔', 'adnominal', 'định ngữ trích dẫn: “lời rủ rằng …” (rút gọn của -자는)', { paren: 'định ngữ trích dẫn' }, { lv: 5 }));
    out.push(E('-냔', 'c', '냔', 'adnominal', 'định ngữ trích dẫn: “câu hỏi rằng …” (rút gọn của -냐는)', { paren: 'định ngữ trích dẫn' }, { lv: 5 }));
    // questions: -냐X
    const Q = [['면', 'connective', 'nếu hỏi là … thì (뭐냐면 = nếu hỏi là gì thì / là vì …)', { post: '(nếu hỏi là …)' }, { rel: 'cond', lv: 5, yo: true }],
      ['니까', 'connective', '(đã hỏi là) … mà', { post: '(đã hỏi … mà)' }, { rel: 'cause', lv: 5, yo: true }],
      ['며', 'connective', 'hỏi rằng … (xác nhận lại)', { post: '(hỏi lại)' }, { rel: 'quote', lv: 5, yo: true }],
      ['는', 'adnominal', 'định ngữ trích dẫn: “câu hỏi rằng …”', { paren: 'định ngữ trích dẫn' }, { lv: 4 }]];
    for (const [s, k, l, c, o] of Q) out.push(E('-냐' + s, 'c', '냐' + s, k, l, c, o));
    out.push(E('-냬', 'c', '냬', 'final', 'hỏi rằng … (rút gọn của -냐고 해)', { pre: 'hỏi rằng' }, { lvl: 'hae', sent: 'decl', lv: 5, yo: true }));
    // proposals: -자X
    const P = [['는', 'adnominal', 'định ngữ trích dẫn: “lời rủ rằng …”', { paren: 'định ngữ trích dẫn' }, { lv: 4 }],
      ['니까', 'connective', '(đã rủ là) … mà', { post: '(đã rủ … mà)' }, { rel: 'cause', lv: 5, yo: true }],
      ['며', 'connective', 'rủ rằng … (xác nhận lại)', { post: '(rủ lại)' }, { rel: 'quote', lv: 5, yo: true }]];
    for (const [s, k, l, c, o] of P) out.push(E('-자' + s, 'c', '자' + s, k, l, c, o));
    out.push(E('-재', 'c', '재', 'final', 'rủ rằng … (rút gọn của -자고 해)', { pre: 'rủ rằng' }, { lvl: 'hae', sent: 'decl', lv: 5, yo: true }));
    // commands: -(으)라X
    const M = [['는', 'adnominal', 'định ngữ trích dẫn: “lời bảo rằng hãy …”', { paren: 'định ngữ trích dẫn' }, { lv: 4 }],
      ['니까', 'connective', '(đã bảo là hãy) … mà', { post: '(đã bảo hãy … mà)' }, { rel: 'cause', lv: 5, yo: true }],
      ['며', 'connective', 'bảo rằng hãy … (xác nhận lại)', { post: '(bảo lại)' }, { rel: 'quote', lv: 5, yo: true }]];
    for (const [s, k, l, c, o] of M) out.push(E('-(으)라' + s, 'u', '라' + s, k, l, c, o));
    out.push(E('-(으)래', 'u', '래', 'final', 'bảo rằng hãy … (rút gọn của -(으)라고 해)', { pre: 'bảo rằng hãy' }, { lvl: 'hae', sent: 'decl', lv: 5, yo: true }));
  }
  pushQuoteFamilies(BASE);

  // Combined 아/어야겠-: 가야겠다, 해야겠어요 ... (must / have to, as a resolution)
  const PREFINAL = {
    H: { id: '-(으)시-', label: 'kính ngữ (người được tôn kính là chủ thể)', compose: { paren: 'kính ngữ' } },
    P: { id: '-았/었-', label: 'quá khứ (đã)', compose: { pre: 'đã' } },
    F: { id: '-겠-', label: 'tương lai / phỏng đoán / ý chí (sẽ, chắc là)', compose: { pre: 'sẽ' } },
    R: { id: '-아야겠-/-어야겠-', label: 'phải … (quyết tâm / thấy cần phải làm)', compose: { pre: 'phải' } },
  };
  // Allowed pre-final chains, in order: honorific < past (< past again) < future / must
  const COMBOS = [[], ['H'], ['P'], ['H', 'P'], ['F'], ['H', 'F'], ['P', 'F'], ['H', 'P', 'F'], ['P', 'P'], ['H', 'P', 'P'], ['P', 'P', 'F'], ['R'], ['H', 'R']];

  // "+요" polite variants, generated.
  const ENDINGS = [];
  for (const e of BASE) {
    ENDINGS.push(e);
    if (e.yo) {
      const cm = Object.assign({}, e.compose, { style: 'lịch sự' });
      ENDINGS.push(Object.assign({}, e, { id: e.id + '요', text: e.mode === 'f' ? e.text.split('|').map((t) => t + '요').join('|') : e.text + '요',
        kind: 'final', label: e.label + ' + -요 (lịch sự)', compose: cm, yo: false, strong: e.strong || false, lvl: 'haeyo', sent: e.sent || 'decl', rel: undefined }));
    }
  }

  // Spoken variants, generated: ...고 -> ...구 (하구요, 아니구, 보라구, 있다구), ...니까 -> ...니깐 (그러니깐, 하니깐).
  const SPOKEN = [[/고(요?)$/, '구$1', '고 → 구', /고(요?)(?=\/|$)/g], [/니까(요?)$/, '니깐$1', '니까 → 니깐', /니까(요?)(?=\/|$)/g]];
  for (const e of ENDINGS.slice()) {
    const forms = e.mode === 'f' ? e.text.split('|') : [e.text];
    for (const [re, rep, note, reId] of SPOKEN) {
      if (!forms.every((t) => re.test(t)) || /ㅂ니까/.test(e.id)) continue; // (-ㅂ니까/-습니까 is the formal question ending, not -니까)
      ENDINGS.push(Object.assign({}, e, { id: e.id.replace(reId, rep), text: forms.map((t) => t.replace(re, rep)).join('|'),
        label: e.label + ' (khẩu ngữ: ' + note + ')', spoken: true, note: undefined, ex: undefined, strong: false }));
    }
  }

  // Tail = the invariant part of the surface (never changed by contraction / merging); used as a cheap pre-filter.
  const isBareJamo = (c) => !!c && c.charCodeAt(0) >= 0x3131 && c.charCodeAt(0) <= 0x314E;
  function commonSuffix(list) {
    let s = list[0];
    for (const t of list.slice(1)) { while (s && !t.endsWith(s)) s = s.slice(1); }
    return s;
  }
  // 하 + ㅈ/ㄱ/ㄷ contracts to an aspirated syllable (원하지 -> 원치): the tail then starts with the aspirated form instead
  const ASPIRATED = { 지: '치', 게: '케', 고: '코', 다: '타', 도: '토' };
  for (const e of ENDINGS) {
    const forms = (e.mode === 'f' ? e.text.split('|') : [e.text]).map((t) => (isBareJamo(t[0]) ? t.slice(1) : t));
    e.tail = commonSuffix(forms);
    if (e.mode === 'c' && e.text && ASPIRATED[e.text[0]]) e.tailAsp = commonSuffix([ASPIRATED[e.text[0]] + e.text.slice(1)]);
  }
  const BY_ID = new Map(ENDINGS.map((e) => [e.id, e]));

  // ====================================================================================================
  // 이다 (copula). c = form after a noun with final consonant (always valid), v = form after a vowel-final noun.
  // ====================================================================================================
  const C = (c, v, label, compose, opts) => Object.assign({ c, v, label, compose: compose || {}, type: 'copula' }, opts || {});
  const COPULA = [
    // formal / polite
    C('입니다', '입니다', 'là (lịch sự, trang trọng)', { pre: 'là', style: 'lịch sự, trang trọng' }, { lvl: 'hapsyo', sent: 'decl' }),
    C('입니까', '입니까', 'là … à? (câu hỏi trang trọng)', { pre: 'là', style: 'câu hỏi, trang trọng' }, { lvl: 'hapsyo', sent: 'ques' }),
    C('이십니다', '이십니다', 'là (kính ngữ, trang trọng)', { pre: 'là', style: 'kính ngữ, trang trọng' }, { lvl: 'hapsyo', sent: 'decl' }),
    C('이에요', '예요', 'là (lịch sự, thân mật)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이어요', '여요', 'là (lịch sự, thân mật)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이세요', '세요', 'là (kính ngữ, lịch sự)', { pre: 'là', style: 'kính ngữ, lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이죠', '죠', 'là … nhỉ (lịch sự)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이지요', '지요', 'là … nhỉ (lịch sự)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이네요', '네요', 'ra là … nhỉ', { pre: 'ra là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl' }),
    C('이군요', '군요', 'thì ra là …', { pre: 'thì ra là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl' }),
    C('이잖아요', '잖아요', 'là … mà', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이거든요', '거든요', 'vì là … mà', { pre: 'vì là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('인데요', '인데요', 'là … đấy / là … mà', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('인가요', '인가요', 'có phải là … không ạ?', { pre: 'có phải là', style: 'câu hỏi, lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('일까요', '일까요', 'liệu có phải là …?', { pre: 'liệu là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('일걸요', '일걸요', 'chắc là … đấy', { pre: 'chắc là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'guess' }),
    C('이래요', '래요', 'nghe nói là … (rút gọn của -이라고 해요)', { pre: 'nghe nói là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이랍니다', '랍니다', 'nghe nói là … đấy ạ', { pre: 'nghe nói là', style: 'lịch sự' }, { lvl: 'hapsyo', sent: 'decl' }),
    C('이었어요', '였어요', 'đã là (lịch sự, thân mật)', { pre: 'đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이었습니다', '였습니다', 'đã là (trang trọng)', { pre: 'đã là', style: 'trang trọng' }, { lvl: 'hapsyo', sent: 'decl' }),
    C('이었죠', '였죠', 'đã là … nhỉ (lịch sự)', { pre: 'đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이었네요', '였네요', 'hóa ra đã là … nhỉ', { pre: 'hóa ra đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl' }),
    C('이었군요', '였군요', 'thì ra đã là …', { pre: 'thì ra đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'excl' }),
    C('이었는데요', '였는데요', 'đã là … mà', { pre: 'đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이겠죠', '겠죠', 'chắc là … nhỉ', { pre: 'chắc là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'guess' }),
    C('이겠어요', '겠어요', 'chắc là … (lịch sự)', { pre: 'chắc là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'guess' }),
    C('이겠습니다', '겠습니다', 'chắc là … (trang trọng)', { pre: 'chắc là', style: 'trang trọng' }, { lvl: 'hapsyo', sent: 'guess' }),
    // intimate / plain
    C('이야', '야', 'là (thân mật)', { pre: 'là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이지', '지', 'là … chứ / nhỉ', { pre: 'là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이네', '네', 'ra là … nhỉ', { pre: 'ra là', style: 'thân mật' }, { lvl: 'hae', sent: 'excl' }),
    C('이군', '군', 'thì ra là …', { pre: 'thì ra là', style: 'thân mật' }, { lvl: 'hae', sent: 'excl' }),
    C('이구나', '구나', 'thì ra là …', { pre: 'thì ra là', style: 'thân mật' }, { lvl: 'hae', sent: 'excl' }),
    C('이잖아', '잖아', 'là … mà', { pre: 'là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이거든', '거든', 'vì là … mà', { pre: 'vì là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('인데', '인데', 'là … nhưng / là … mà', { pre: 'là', post: 'nhưng / mà' }, { lvl: 'hae', sent: 'decl' }),
    C('인가', '인가', 'có phải là … không nhỉ?', { pre: 'có phải là', style: 'câu hỏi, thân mật' }, { lvl: 'hae', sent: 'ques' }),
    C('이니', '니', 'là … à? (câu hỏi thân mật)', { pre: 'là', style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques' }),
    C('이냐', '냐', 'là … à? (câu hỏi thân mật)', { pre: 'là', style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques' }),
    C('일지', '일지', 'liệu có phải là …', { pre: 'liệu là' }),
    C('일걸', '일걸', 'chắc là … đấy', { pre: 'chắc là', style: 'thân mật' }, { lvl: 'hae', sent: 'guess' }),
    C('일까', '일까', 'liệu có phải là … (tự hỏi)', { pre: 'liệu là', style: 'thân mật' }, { lvl: 'hae', sent: 'ques' }),
    C('이래', '래', 'nghe nói là … (rút gọn của -이라고 해)', { pre: 'nghe nói là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이란다', '란다', 'nghe nói là … đấy (con)', { pre: 'nghe nói là', style: 'thân mật' }, { lvl: 'haera', sent: 'decl' }),
    C('이었어', '였어', 'đã là (thân mật)', { pre: 'đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이었다', '였다', 'đã là (văn viết)', { pre: 'đã là', style: 'văn viết' }, { lvl: 'haera', sent: 'decl' }),
    C('이었지', '였지', 'đã là … nhỉ', { pre: 'đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이었네', '였네', 'hóa ra đã là … nhỉ', { pre: 'hóa ra đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'excl' }),
    C('이었잖아', '였잖아', 'đã là … mà', { pre: 'đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'decl' }),
    C('이었잖아요', '였잖아요', 'đã là … mà', { pre: 'đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이었을까', '였을까', 'liệu đã là …?', { pre: 'liệu đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'ques' }),
    C('이었을까요', '였을까요', 'liệu đã là …?', { pre: 'liệu đã là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('이니까요', '니까요', 'vì là … mà', { pre: 'vì là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이라서요', '라서요', 'vì là … ấy mà', { pre: 'vì là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이고요', '고요', 'là … và / là … đấy (lịch sự)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이냐고', '냐고', 'hỏi rằng có phải là …', { pre: 'hỏi có phải là' }, { rel: 'quote' }),
    C('이냐고요', '냐고요', 'hỏi rằng có phải là … ư? (lịch sự)', { pre: 'hỏi có phải là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('이냐면', '냐면', 'nếu hỏi là … thì (뭐냐면 = nếu hỏi là gì thì)', { pre: 'nếu hỏi là', post: 'thì' }, { rel: 'cond' }),
    C('이냐면요', '냐면요', 'nếu hỏi là … thì (lịch sự)', { pre: 'nếu hỏi là', post: 'thì', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이냐니까', '냐니까', '(đã hỏi là) … mà', { pre: 'đã hỏi là', post: 'mà' }, { rel: 'cause' }),
    C('이냐니까요', '냐니까요', '(đã hỏi là) … mà (lịch sự)', { pre: 'đã hỏi là', post: 'mà', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이냐며', '냐며', 'hỏi rằng là … (xác nhận lại)', { pre: 'hỏi rằng là' }, { rel: 'quote' }),
    C('이냐는', '냐는', 'định ngữ trích dẫn: “câu hỏi rằng là …”', { pre: 'hỏi là', paren: 'định ngữ trích dẫn' }, { adn: true }),
    C('이라곤', '라곤', 'nói là … thì (rút gọn của -이라고는)', { pre: 'nói là', post: '(thì)' }, { rel: 'quote' }),
    C('이라고요', '라고요', '(tôi nói) là … mà / là … ư?', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('이라구요', '라구요', '(tôi nói) là … mà / là … ư? (khẩu ngữ)', { pre: 'là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'ques' }),
    C('이라는데요', '라는데요', 'nghe nói là … mà', { pre: 'nghe nói là', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이구요', '구요', 'là … và (khẩu ngữ)', { pre: 'là', post: 'và', style: 'lịch sự' }, { lvl: 'haeyo', sent: 'decl' }),
    // honorific copula (선생님이시죠?)
    C('이십니까', '십니까', 'là … ạ? (kính ngữ, trang trọng)', { pre: 'là', style: 'kính ngữ, câu hỏi' }, { lvl: 'hapsyo', sent: 'ques' }),
    C('이시죠', '시죠', 'là … phải không ạ (kính ngữ)', { pre: 'là', style: 'kính ngữ' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이시군요', '시군요', 'thì ra là … (kính ngữ)', { pre: 'thì ra là', style: 'kính ngữ' }, { lvl: 'haeyo', sent: 'excl' }),
    C('이셨어요', '셨어요', 'đã là (kính ngữ)', { pre: 'đã là', style: 'kính ngữ' }, { lvl: 'haeyo', sent: 'decl' }),
    C('이셨습니다', '셨습니다', 'đã là (kính ngữ, trang trọng)', { pre: 'đã là', style: 'kính ngữ, trang trọng' }, { lvl: 'hapsyo', sent: 'decl' }),
    C('이시고', '시고', 'là … và (kính ngữ)', { pre: 'là', post: 'và', style: 'kính ngữ' }, { rel: 'list' }),
    C('이신', '신', 'là (kính ngữ, định ngữ)', { pre: 'là', paren: 'định ngữ, kính ngữ' }, { adn: true }),
    C('이시면', '시면', 'nếu là … (kính ngữ)', { pre: 'nếu là', style: 'kính ngữ' }, { rel: 'cond' }),
    C('이었구나', '였구나', 'thì ra đã là …', { pre: 'thì ra đã là', style: 'thân mật' }, { lvl: 'hae', sent: 'excl' }),
    C('이었니', '였니', 'đã là … à?', { pre: 'đã là', style: 'câu hỏi, thân mật' }, { lvl: 'haera', sent: 'ques' }),
    C('이겠지', '겠지', 'chắc là … nhỉ', { pre: 'chắc là', style: 'thân mật' }, { lvl: 'hae', sent: 'guess' }),
    C('이겠어', '겠어', 'chắc là … (thân mật)', { pre: 'chắc là', style: 'thân mật' }, { lvl: 'hae', sent: 'guess' }),
    C('이겠네', '겠네', 'chắc là … nhỉ', { pre: 'chắc là', style: 'thân mật' }, { lvl: 'hae', sent: 'guess' }),
    C('이다', '다', 'là (dạng từ điển / văn viết)', { pre: 'là', style: 'văn viết' }, { lvl: 'haera', sent: 'decl' }),
    // old-fashioned
    C('이오', '요', 'là (kiểu cổ, 하오체)', { pre: 'là', style: 'kiểu cổ' }, { lvl: 'hao', sent: 'decl' }),
    C('일세', '일세', 'là … đấy (kiểu cổ, 하게체)', { pre: 'là', style: 'kiểu cổ' }, { lvl: 'hage', sent: 'decl' }),
    C('이로구나', '로구나', 'thì ra là … (kiểu cổ)', { pre: 'thì ra là', style: 'kiểu cổ' }, { lvl: 'haera', sent: 'excl' }),
    C('이로군', '로군', 'thì ra là … (kiểu cổ)', { pre: 'thì ra là', style: 'kiểu cổ' }, { lvl: 'hage', sent: 'excl' }),
    // connective
    C('이고', '고', 'là … và', { pre: 'là', post: 'và' }, { rel: 'list' }),
    C('이며', '며', 'là … và (văn viết)', { pre: 'là', post: 'và' }, { rel: 'list' }),
    C('이자', '자', 'vừa là … vừa là', { pre: 'vừa là' }, { rel: 'list' }),
    C('이지만', '지만', 'là … nhưng', { pre: 'là', post: 'nhưng' }, { rel: 'contrast' }),
    C('이라서', '라서', 'vì là …', { pre: 'vì là' }, { rel: 'cause' }),
    C('이어서', '여서', 'vì là … / là … rồi', { pre: 'vì là' }, { rel: 'cause' }),
    C('이니까', '니까', 'vì là …', { pre: 'vì là' }, { rel: 'cause' }),
    C('이므로', '므로', 'vì là … (trang trọng)', { pre: 'vì là' }, { rel: 'cause' }),
    C('이면', '면', 'nếu là …', { pre: 'nếu là' }, { rel: 'cond' }),
    C('이라면', '라면', 'nếu là …', { pre: 'nếu là' }, { rel: 'cond' }),
    C('이었다면', '였다면', 'nếu đã là …', { pre: 'nếu đã là' }, { rel: 'cond' }),
    C('이었더라면', '였더라면', 'giá mà đã là …', { pre: 'giá mà đã là' }, { rel: 'cond' }),
    C('이어도', '여도', 'dù là …', { pre: 'dù là' }, { rel: 'conc' }),
    C('이라도', '라도', 'dù là … / ít nhất là …', { pre: 'dù là' }, { rel: 'conc' }),
    C('이더라도', '더라도', 'cho dù là …', { pre: 'cho dù là' }, { rel: 'conc' }),
    C('인지', '인지', 'liệu có phải là … hay không', { pre: 'liệu là' }, { rel: 'quote' }),
    C('인지는', '인지는', 'liệu có phải là … thì', { pre: 'liệu là' }, { rel: 'quote' }),
    C('인지도', '인지도', 'liệu có phải là … cũng (không biết)', { pre: 'liệu là' }, { rel: 'quote' }),
    C('인데도', '인데도', 'dù là … vẫn', { pre: 'dù là' }, { rel: 'conc' }),
    C('이라', '라', 'là … (nên) / vì là …', { pre: 'vì là' }, { rel: 'cause' }),
    C('이라니', '라니', 'là … ư (ngạc nhiên)', { pre: 'là', post: '(ngạc nhiên)' }, { rel: 'quote' }),
    C('이라는데', '라는데', 'nghe nói là … mà', { pre: 'nghe nói là' }, { rel: 'bg' }),
    C('이라구', '라구', 'gọi là / nói là … (khẩu ngữ)', { pre: 'gọi là' }, { rel: 'quote' }),
    C('이구', '구', 'là … và (khẩu ngữ)', { pre: 'là', post: 'và' }, { rel: 'list' }),
    C('이거나', '거나', 'là … hoặc', { pre: 'là', post: 'hoặc' }, { rel: 'alt' }),
    C('이어야', '여야', 'phải là … mới', { pre: 'phải là' }, { rel: 'cond' }),
    C('이어야만', '여야만', 'chỉ khi là …', { pre: 'chỉ khi là' }, { rel: 'cond' }),
    C('이니깐', '니깐', 'vì là … (khẩu ngữ)', { pre: 'vì là' }, { rel: 'cause' }),
    C('이든', '든', 'dù là … hay …', { pre: 'dù là' }, { rel: 'alt' }),
    C('이든지', '든지', 'dù là … hay …', { pre: 'dù là' }, { rel: 'alt' }),
    C('이나', '나', 'là … hoặc / là … nhưng', { pre: 'là' }, { rel: 'alt' }),
    C('이면서', '면서', 'vừa là … vừa', { pre: 'vừa là' }, { rel: 'simul' }),
    C('이었지만', '였지만', 'đã là … nhưng', { pre: 'đã là', post: 'nhưng' }, { rel: 'contrast' }),
    C('이었고', '였고', 'đã là … và', { pre: 'đã là', post: 'và' }, { rel: 'list' }),
    C('이었는데', '였는데', 'đã là … nhưng / mà', { pre: 'đã là', post: 'nhưng / mà' }, { rel: 'bg' }),
    C('이었으면', '였으면', 'giá mà là …', { pre: 'giá mà là' }, { rel: 'cond' }),
    C('이라고', '라고', 'gọi là / nói rằng là …', { pre: 'gọi là' }, { rel: 'quote' }),
    C('이라니까', '라니까', '(đã bảo) là … mà', { pre: 'là' }, { rel: 'cause' }),
    C('이라며', '라며', 'nghe nói là … (xác nhận lại)', { pre: 'nghe nói là' }, { rel: 'quote' }),
    C('이라면서', '라면서', 'nghe nói là … (xác nhận lại)', { pre: 'nghe nói là' }, { rel: 'quote' }),
    C('이라던데', '라던데', 'nghe nói là … mà', { pre: 'nghe nói là' }, { rel: 'bg' }),
    C('이라길래', '라길래', 'vì nghe nói là … nên', { pre: 'vì nghe nói là' }, { rel: 'cause' }),
    C('이라는', '라는', 'được gọi là … / cái gọi là', { pre: 'được gọi là', paren: 'định ngữ' }, { adn: true }),
    C('이란', '란', 'nói đến … thì (nêu định nghĩa)', { pre: 'nói đến' }, { adn: true }),
    C('이라던', '라던', 'từng nói là …', { pre: 'từng nói là', paren: 'định ngữ' }, { adn: true }),
    C('이었던', '였던', 'đã từng là (định ngữ)', { pre: 'đã từng là', paren: 'định ngữ' }, { adn: true }),
    C('이었을', '였을', 'có lẽ đã là (định ngữ)', { pre: 'có lẽ đã là', paren: 'định ngữ' }, { adn: true }),
    C('이던', '던', 'từng là (định ngữ)', { pre: 'từng là', paren: 'định ngữ' }, { adn: true }),
    C('인', '인', 'là (định ngữ)', { pre: 'là', paren: 'định ngữ' }, { adn: true }),
    C('일', '일', 'sẽ là / có lẽ là (định ngữ)', { pre: 'sẽ là', paren: 'định ngữ' }, { adn: true }),
    C('일지도', '일지도', 'có lẽ là … cũng nên', { pre: 'có lẽ là' }, {}),
    C('이기', '이기', 'việc là … (danh từ hóa)', { pre: 'việc là' }, { nom: true }),
    C('임', '임', 'việc là … (danh từ hóa)', { pre: 'việc là' }, { nom: true }),
  ];

  // The copula of the pseudo-noun 거 (것): contracted spoken forms, matched on the whole surface.
  const BOUND_COPULA = {
    건데: { noun: '것', tail: '인데', label: 'là … (것이 + -ㄴ데: dạng rút gọn)', compose: { pre: 'là', post: 'nhưng / mà' } },
    건데요: { noun: '것', tail: '인데요', label: 'là … đấy / mà (lịch sự)', compose: { pre: 'là', style: 'lịch sự' } },
    건가: { noun: '것', tail: '인가', label: 'có phải là … không nhỉ?', compose: { pre: 'có phải là' } },
    건가요: { noun: '것', tail: '인가요', label: 'có phải là … không ạ?', compose: { pre: 'có phải là', style: 'câu hỏi, lịch sự' } },
    건지: { noun: '것', tail: '인지', label: 'liệu có phải là …', compose: { pre: 'liệu là' } },
    겁니다: { noun: '것', tail: '입니다', label: 'là … (lịch sự, trang trọng)', compose: { pre: 'là', style: 'lịch sự, trang trọng' } },
    겁니까: { noun: '것', tail: '입니까', label: 'là … à? (trang trọng)', compose: { pre: 'là', style: 'câu hỏi, trang trọng' } },
  };

  K.Endings = { ENDINGS, BY_ID, PREFINAL, COMBOS, COPULA, BOUND_COPULA };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Endings;
})(typeof globalThis !== 'undefined' ? globalThis : this);
