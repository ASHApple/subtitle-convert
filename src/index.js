import { TextDecoder } from 'text-encoding';
import fs from 'fs';
import { Iconv } from 'iconv';
import path from 'path';
import DetectEncoding from 'detect-character-encoding';
import kNode from 'detect-node';
import VTTWriter from './vttwriter';
import smiParser from './smiparser';
import vttParser from './vttparser';

class SubtitleConverter {
  constructor(...args) {
    this.loaded = false;
    if (arguments.length > 0) {
      this.load(...args);
    }
  }
  load(filename, ext, encode, targetencode = 'UTF-8') {
    try {
      if (kNode) {
        const raw = fs.readFileSync(filename);
        const autoencode = DetectEncoding(raw);
        let enc = null;
        if (arguments.length <= 2) {
          enc = autoencode.encoding;
        } else if (autoencode.encoding !== encode.toUpperCase()) {
          console.log(`[Warning] Expected encoding : ${autoencode.encoding} / Input : ${encode}`);
        }
        if (!enc) {
          enc = encode;
        }
        const iconv = new Iconv(enc, targetencode);
        const convraw = iconv.convert(raw);
        this.encoded = new TextDecoder(targetencode).decode(convraw);
        this.originext = ext || path.extname(filename).toUpperCase();
      } else {
        this.encoded = filename;
        this.originext = ext;
      }
      this.originext = this.originext.toUpperCase();
      this.targetencode = targetencode;
      this.parsed = false;
      this.loaded = true;
      return true;
    } catch (e) {
      return false;
    }
  }
  parse(object) {
    if (object !== undefined) {
      try {
        const that = JSON.parse(object);
        this.originext = that.originext;
        this.targetencode = that.targetencode;
        this.parsed = that.parsed;
        this.loaded = that.loaded;
        this.parsed.cueList = this.parsed.cueList.map((el) => {
          const newel = Object.assign({}, el);
          newel.start = new Date(el.start);
          newel.end = new Date(el.end);
          return newel;
        });
        return true;
      } catch (e) {
        return false;
      }
    }
    if (!this.loaded) {
      return false;
    }
    switch (this.originext) {
      case '.SMI':
        this.parsed = smiParser(this.encoded);
        break;
      case '.VTT':
        this.parsed = vttParser(this.encoded);
        break;
      default:
        return false;
    }
    return true;
  }
  convert(type, target) {
    let res = false;
    if (!this.parsed && !this.parse()) {
      console.log(`
        Parse failed! you may forgot to load before covert or
        there is no method to parse : ${this.originext}.
      `);
      return false;
    }
    if (type === undefined) {
      console.log(`
        There is no type to convert : ${type}. Please check arguments.
      `);
      return false;
    }
    const upperType = type.toUpperCase();
    if (upperType === '.VTT') {
      res = new VTTWriter(
        this.parsed,
        type,
        this.targetencode,
      ).write(target);
    } else {
      console.log(`
        There are no such types to convert : ${upperType}
      `);
      return res;
    }
    return res;
  }
  delay(time, index, resize) {
    if (!this.parsed) {
      console.log(`
        You must parse data before using this method.
      `);
      return false;
    }
    let [sec, milli] = time.toString(10).split('.');
    if (milli !== undefined) {
      milli = parseInt(milli, 10);
      if (milli < 10) {
        milli *= 100;
      } else if (milli < 100) {
        milli *= 10;
      }
      if (sec.match('-')) {
        milli *= -1;
      }
    }
    sec = parseInt(sec, 10);
    if (index === undefined) {
      this.parsed.cueList.forEach((el) => {
        resize !== undefined || el.start
          .setUTCSeconds(el.start.getUTCSeconds() + sec);
        el.end.setSeconds(el.end.getUTCSeconds() + sec);
        if (milli !== undefined) {
          resize !== undefined || el.start
            .setUTCMilliseconds(el.start.getUTCMilliseconds() + milli);
          el.end.setUTCMilliseconds(el.end.getUTCMilliseconds() + milli);
        }
      });
    } else if (index < this.parsed.cueList.length) {
      resize !== undefined || this.parsed
        .cueList[index]
        .start
        .setUTCSeconds(this.parsed.cueList[index].start.getUTCSeconds() + sec);
      this.parsed
        .cueList[index]
        .end
        .setUTCSeconds(this.parsed.cueList[index].end.getUTCSeconds() + sec);
      if (milli !== undefined) {
        resize === undefined || this.parsed
          .cueList[index]
          .start
          .setUTCMilliseconds(this.parsed.cueList[index].start.getUTCMilliseconds() + milli);
        this.parsed
          .cueList[index]
          .end
          .setUTCMilliseconds(this.parsed.cueList[index].end.getUTCMilliseconds() + milli);
      }
    } else {
      return false;
    }
    return true;
  }
  resize(time, index) {
    this.delay(time, index, true);
  }
  stringify() {
    const that = {
      originext: this.originext,
      targetencode: this.targetencode,
      loaded: this.loaded,
      parsed: this.parsed,
    };
    return JSON.stringify(that);
  }
}

export default SubtitleConverter;
