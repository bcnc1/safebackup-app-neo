export class ObjectUtils {

  static isEmpty(val) {

    // test results
    // []        true, empty array
    // {}        true, empty object
    // null      true
    // undefined true
    // ""        true, empty string
    // ''        true, empty string
    // 0         false, number
    // true      false, boolean
    // false     false, boolean
    // Date      false
    // function  false

    if (val === undefined || val === null) {
      return true;
    }
    if (typeof (val) === 'function' || typeof (val) === 'number' || typeof (val) === 'boolean') {
      return false;
    }
    if (Object.prototype.toString.call(val) === '[object Date]') {
      return false;
    }

    if (val == null || val.length === 0) {     // null or 0 length array
      return true;
    }

    if (Array.isArray(val) && val.length === 0) {
      return true;
    }
    if (val.constructor === Object && Object.keys(val).length === 0) {
      return true;
    }
    return false;
  }

  static isNotEmpty(val) {
    return !this.isEmpty(val);
  }

  static getIdArray(list) {
    const ids = [];
    list.forEach(element => {
      ids.push(element.id);
    });
    return ids;
  }


  static getNumber(v) {
    if (v === 0) {
      return 0;
    }
    return v;
  }


  static copy(obj) {
    return Object.assign({}, obj);
  }

}
