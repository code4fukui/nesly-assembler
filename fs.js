export default {
  readFileSync: (s, opt) => {
    if (opt != "binary") {
      throw new Error("not supported opt: " + opt);
    }
    console.log("read", s);
    const res = Deno.readFileSync(s);
    console.log(res);
    const ss = [];
    for (let i = 0; i < res.length; i++) {
      ss.push(String.fromCharCode(res[i]));
    }
    return ss.join("");
  },
  writeFileSync: (s, data, opt) => {
    if (opt != "binary") {
      throw new Error("not supported opt: " + opt);
    }
    console.log(typeof data);
    const bin = new Uint8Array(data.length);
    for (let i = 0; i < bin.length; i++) {
      bin[i] = data[i].charCodeAt(0);
    }
    Deno.writeFileSync(s, bin);
  },
};