/* Pronunciation: pronunciation.speak(text, language) via the Web Speech API (speechSynthesis).
 * The language id is mapped to a speech tag by the LanguagePack ("ko" -> "ko-KR"), so Japanese/Chinese/... work
 * through the same call once their packs exist. Fully local: the browser/OS speech engine does the work.
 *
 * Linux note: Firefox uses speech-dispatcher. If no Korean voice is installed we report a clear reason
 * instead of silently reading Korean with an English voice. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  class Pronunciation {
    /** @param {{synth?:SpeechSynthesis, Utterance?:Function, packs?:object, getRate?:Function, voiceWaitMs?:number, maxSpeakMs?:number}} o */
    constructor(o) {
      const opts = o || {};
      this._synth = opts.synth;
      this._U = opts.Utterance;
      this.packs = opts.packs || LF.LanguagePackManager;
      this.getRate = opts.getRate || (() => 0.9);
      this.voiceWaitMs = opts.voiceWaitMs == null ? 1500 : opts.voiceWaitMs;
      this.maxSpeakMs = opts.maxSpeakMs == null ? 20000 : opts.maxSpeakMs;
    }
    get synth() { return this._synth || root.speechSynthesis || null; }
    get Utterance() { return this._U || root.SpeechSynthesisUtterance || null; }
    isSupported() { return !!this.synth && !!this.Utterance; }

    speechLang(language) {
      const pack = this.packs && this.packs.get ? this.packs.get(language) : null;
      return pack ? pack.getSpeechLang() : language;
    }
    /** Voices load asynchronously in most browsers: wait (bounded) for the first non-empty list. */
    async getVoices() {
      const s = this.synth;
      if (!s) return [];
      let v = s.getVoices();
      if (v && v.length) return v;
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        if (s.addEventListener) s.addEventListener('voiceschanged', finish, { once: true });
        setTimeout(finish, this.voiceWaitMs);
      });
      v = s.getVoices();
      return v || [];
    }
    pickVoice(voices, lang) {
      const l = lang.toLowerCase(), base = l.split('-')[0];
      return voices.find((x) => (x.lang || '').toLowerCase().replace('_', '-') === l) || voices.find((x) => (x.lang || '').toLowerCase().replace('_', '-').startsWith(base)) || null;
    }
    /** @returns {Promise<{ok:boolean, reason?:string, lang?:string, voice?:string}>} reason: unsupported | empty | no-voices | no-voice-for-language | error */
    async speak(text, language, opts) {
      const o = opts || {};
      const t = String(text == null ? '' : text).trim();
      if (!t) return { ok: false, reason: 'empty' };
      if (!this.isSupported()) return { ok: false, reason: 'unsupported' };
      const lang = this.speechLang(language);
      const voices = await this.getVoices();
      if (!voices.length) return { ok: false, reason: 'no-voices', lang };
      const voice = this.pickVoice(voices, lang);
      if (!voice && !o.force) return { ok: false, reason: 'no-voice-for-language', lang };
      const s = this.synth;
      try { s.cancel(); } catch (e) { /* ignore */ }
      const u = new this.Utterance(t);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = o.rate || this.getRate();
      return new Promise((resolve) => {
        let settled = false;
        const done = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
        const timer = setTimeout(() => done({ ok: true, lang, voice: voice && voice.name }), this.maxSpeakMs);
        u.onend = () => done({ ok: true, lang, voice: voice && voice.name });
        u.onerror = (e) => done(e && (e.error === 'canceled' || e.error === 'interrupted') ? { ok: true, lang } : { ok: false, reason: 'error', detail: e && e.error, lang });
        try { s.speak(u); } catch (e) { done({ ok: false, reason: 'error', detail: String(e) }); }
      });
    }
    stop() { try { if (this.synth) this.synth.cancel(); } catch (e) { /* ignore */ } }
  }

  LF.Pronunciation = Pronunciation;
  LF.pronunciation = new Pronunciation({});
  if (typeof module !== 'undefined' && module.exports) module.exports = Pronunciation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
