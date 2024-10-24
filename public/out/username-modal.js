// node_modules/@elysiajs/eden/dist/chunk-XYW4OUFN.mjs
var s = class extends Error {
  constructor(e, n) {
    super(n + "");
    this.status = e;
    this.value = n;
  }
};
var i = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
var o = /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT(?:\+|-)\d{4}\s\([^)]+\)/;
var c = /^(?:(?:(?:(?:0?[1-9]|[12][0-9]|3[01])[/\s-](?:0?[1-9]|1[0-2])[/\s-](?:19|20)\d{2})|(?:(?:19|20)\d{2}[/\s-](?:0?[1-9]|1[0-2])[/\s-](?:0?[1-9]|[12][0-9]|3[01]))))(?:\s(?:1[012]|0?[1-9]):[0-5][0-9](?::[0-5][0-9])?(?:\s[AP]M)?)?$/;
var u = (t) => t.trim().length !== 0 && !Number.isNaN(Number(t));
var d = (t) => {
  if (typeof t != "string")
    return null;
  let r = t.replace(/"/g, "");
  if (i.test(r) || o.test(r) || c.test(r)) {
    let e = new Date(r);
    if (!Number.isNaN(e.getTime()))
      return e;
  }
  return null;
};
var a = (t) => {
  let r = t.charCodeAt(0), e = t.charCodeAt(t.length - 1);
  return r === 123 && e === 125 || r === 91 && e === 93;
};
var p = (t) => JSON.parse(t, (r, e) => {
  let n = d(e);
  return n || e;
});
var g = (t) => {
  if (!t)
    return t;
  if (u(t))
    return +t;
  if (t === "true")
    return true;
  if (t === "false")
    return false;
  let r = d(t);
  if (r)
    return r;
  if (a(t))
    try {
      return p(t);
    } catch {
    }
  return t;
};
var S = (t) => {
  let r = t.data.toString();
  return r === "null" ? null : g(r);
};

// node_modules/@elysiajs/eden/dist/chunk-2IHGLN7W.mjs
var $ = typeof FileList > "u";

// node_modules/@elysiajs/eden/dist/chunk-7WO4HTSU.mjs
var F = class {
  constructor(t) {
    this.url = t;
    this.ws = new WebSocket(t);
  }
  ws;
  send(t) {
    return Array.isArray(t) ? (t.forEach((n) => this.send(n)), this) : (this.ws.send(typeof t == "object" ? JSON.stringify(t) : t.toString()), this);
  }
  on(t, n, s2) {
    return this.addEventListener(t, n, s2);
  }
  off(t, n, s2) {
    return this.ws.removeEventListener(t, n, s2), this;
  }
  subscribe(t, n) {
    return this.addEventListener("message", t, n);
  }
  addEventListener(t, n, s2) {
    return this.ws.addEventListener(t, (c2) => {
      if (t === "message") {
        let f = S(c2);
        n({ ...c2, data: f });
      } else
        n(c2);
    }, s2), this;
  }
  removeEventListener(t, n, s2) {
    return this.off(t, n, s2), this;
  }
  close() {
    return this.ws.close(), this;
  }
};
var N = ["get", "post", "put", "delete", "patch", "options", "head", "connect", "subscribe"];
var I = ["localhost", "127.0.0.1", "0.0.0.0"];
var C = typeof FileList > "u";
var q = (e) => C ? e instanceof Blob : e instanceof FileList || e instanceof File;
var P = (e) => {
  if (!e)
    return false;
  for (let t in e)
    if (q(e[t]) || Array.isArray(e[t]) && e[t].find(q))
      return true;
  return false;
};
var j = (e) => C ? e : new Promise((t) => {
  let n = new FileReader;
  n.onload = () => {
    let s2 = new File([n.result], e.name, { lastModified: e.lastModified, type: e.type });
    t(s2);
  }, n.readAsArrayBuffer(e);
});
var b = (e, t, n = {}, s2 = {}) => {
  if (Array.isArray(e)) {
    for (let c2 of e)
      if (!Array.isArray(c2))
        s2 = b(c2, t, n, s2);
      else {
        let f = c2[0];
        if (typeof f == "string")
          s2[f.toLowerCase()] = c2[1];
        else
          for (let [a2, w] of f)
            s2[a2.toLowerCase()] = w;
      }
    return s2;
  }
  if (!e)
    return s2;
  switch (typeof e) {
    case "function":
      if (e instanceof Headers)
        return b(e, t, n, s2);
      let c2 = e(t, n);
      return c2 ? b(c2, t, n, s2) : s2;
    case "object":
      if (e instanceof Headers)
        return e.forEach((f, a2) => {
          s2[a2.toLowerCase()] = f;
        }), s2;
      for (let [f, a2] of Object.entries(e))
        s2[f.toLowerCase()] = a2;
      return s2;
    default:
      return s2;
  }
};
async function* U(e) {
  let t = e.body;
  if (!t)
    return;
  let n = t.getReader(), s2 = new TextDecoder;
  try {
    for (;; ) {
      let { done: c2, value: f } = await n.read();
      if (c2)
        break;
      let a2 = s2.decode(f);
      yield g(a2);
    }
  } finally {
    n.releaseLock();
  }
}
var A = (e, t, n = [], s2) => new Proxy(() => {
}, { get(c2, f) {
  return A(e, t, f === "index" ? n : [...n, f], s2);
}, apply(c2, f, [a2, w]) {
  if (!a2 || w || typeof a2 == "object" && Object.keys(a2).length !== 1 || N.includes(n.at(-1))) {
    let K = [...n], k = K.pop(), g2 = "/" + K.join("/"), { fetcher: D = fetch, headers: L, onRequest: p2, onResponse: E, fetch: H } = t, m = k === "get" || k === "head" || k === "subscribe";
    L = b(L, g2, w);
    let T = m ? a2?.query : w?.query, R = "";
    if (T) {
      let r = (h, d2) => {
        R += (R ? "&" : "?") + `${encodeURIComponent(h)}=${encodeURIComponent(d2)}`;
      };
      for (let [h, d2] of Object.entries(T)) {
        if (Array.isArray(d2)) {
          for (let o2 of d2)
            r(h, o2);
          continue;
        }
        if (typeof d2 == "object") {
          r(h, JSON.stringify(d2));
          continue;
        }
        r(h, `${d2}`);
      }
    }
    if (k === "subscribe") {
      let r = e.replace(/^([^]+):\/\//, e.startsWith("https://") ? "wss://" : e.startsWith("http://") || I.find((h) => e.includes(h)) ? "ws://" : "wss://") + g2 + R;
      return new F(r);
    }
    return (async () => {
      let r = { method: k?.toUpperCase(), body: a2, ...H, headers: L };
      r.headers = { ...L, ...b(m ? a2?.headers : w?.headers, g2, r) };
      let h = m && typeof a2 == "object" ? a2.fetch : w?.fetch;
      if (r = { ...r, ...h }, m && delete r.body, p2) {
        Array.isArray(p2) || (p2 = [p2]);
        for (let y of p2) {
          let i2 = await y(g2, r);
          typeof i2 == "object" && (r = { ...r, ...i2, headers: { ...r.headers, ...b(i2.headers, g2, r) } });
        }
      }
      if (m && delete r.body, P(a2)) {
        let y = new FormData;
        for (let [i2, u2] of Object.entries(r.body)) {
          if (C) {
            y.append(i2, u2);
            continue;
          }
          if (u2 instanceof File) {
            y.append(i2, await j(u2));
            continue;
          }
          if (u2 instanceof FileList) {
            for (let v = 0;v < u2.length; v++)
              y.append(i2, await j(u2[v]));
            continue;
          }
          if (Array.isArray(u2)) {
            for (let v = 0;v < u2.length; v++) {
              let W = u2[v];
              y.append(i2, W instanceof File ? await j(W) : W);
            }
            continue;
          }
          y.append(i2, u2);
        }
        r.body = y;
      } else
        typeof a2 == "object" ? (r.headers["content-type"] = "application/json", r.body = JSON.stringify(a2)) : a2 != null && (r.headers["content-type"] = "text/plain");
      if (m && delete r.body, p2) {
        Array.isArray(p2) || (p2 = [p2]);
        for (let y of p2) {
          let i2 = await y(g2, r);
          typeof i2 == "object" && (r = { ...r, ...i2, headers: { ...r.headers, ...b(i2.headers, g2, r) } });
        }
      }
      let d2 = e + g2 + R, o2 = await (s2?.handle(new Request(d2, r)) ?? D(d2, r)), l = null, S2 = null;
      if (E) {
        Array.isArray(E) || (E = [E]);
        for (let y of E)
          try {
            let i2 = await y(o2.clone());
            if (i2 != null) {
              l = i2;
              break;
            }
          } catch (i2) {
            i2 instanceof s ? S2 = i2 : S2 = new s(422, i2);
            break;
          }
      }
      if (l !== null)
        return { data: l, error: S2, response: o2, status: o2.status, headers: o2.headers };
      switch (o2.headers.get("Content-Type")?.split(";")[0]) {
        case "text/event-stream":
          l = U(o2);
          break;
        case "application/json":
          l = await o2.json();
          break;
        case "application/octet-stream":
          l = await o2.arrayBuffer();
          break;
        case "multipart/form-data":
          let y = await o2.formData();
          l = {}, y.forEach((i2, u2) => {
            l[u2] = i2;
          });
          break;
        default:
          l = await o2.text().then(g);
      }
      return (o2.status >= 300 || o2.status < 200) && (S2 = new s(o2.status, l), l = null), { data: l, error: S2, response: o2, status: o2.status, headers: o2.headers };
    })();
  }
  return typeof a2 == "object" ? A(e, t, [...n, Object.values(a2)[0]], s2) : A(e, t, n);
} });
var V = (e, t = {}) => typeof e == "string" ? (t.keepDomain || (e.includes("://") || (e = (I.find((n) => e.includes(n)) ? "http://" : "https://") + e), e.endsWith("/") && (e = e.slice(0, -1))), A(e, t)) : (typeof window < "u" && console.warn("Elysia instance server found on client side, this is not recommended for security reason. Use generic type instead."), A("http://e.ly", t, [], e));

// client/username-modal.ts
var client = V("localhost:3000");
var ALPHANUM = /^\w+$/;
var usernameConfigInput = htmx.find("#user-config .username-input");
var usernameInput = htmx.find("#username-input");
var usernameModal = htmx.find("#username-modal");
var usernameSubmit = htmx.find("#username-submit");
{
  const { data, error } = await client.api.username.get();
  if (!error) {
    if (data.success) {
      usernameConfigInput.value = data.username;
    } else {
      usernameModal.showModal();
    }
  }
}
function isUsernameValid(username) {
  return username.length >= 1 && username.length <= 32 && ALPHANUM.test(username);
}
htmx.on("#username-input", "change", () => {
  usernameSubmit.disabled = !isUsernameValid(usernameInput.value);
});
htmx.on("#username-modal", "htmx:before-request", (rawEvt) => {
  const evt = rawEvt;
  const parameters = evt.detail.requestConfig.parameters;
  const username = parameters.get("username").valueOf();
  if (typeof username !== "string") {
    alert("username must be present");
  } else if (username.length < 1) {
    alert("username must have at least 1 character");
  } else if (!ALPHANUM.test(username)) {
    alert("username must be entirely alphanumeric");
  } else if (username.length > 32) {
    alert("username must have at most 32 characters");
  } else {
    return;
  }
  evt.preventDefault();
});
htmx.on("#username-modal", "htmx:after-request", (rawEvt) => {
  const evt = rawEvt;
  const xhr = evt.detail.xhr;
  if (xhr.status < 200 || xhr.status >= 300)
    return;
  const response = JSON.parse(xhr.response);
  console.log(response);
  if (response.success) {
    usernameModal.close();
  } else {
    alert(response.message);
  }
});
