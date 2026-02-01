import { signAccess } from "./jwts";

class TestClient {
  private params: URLSearchParams;

  constructor(
    private headers: Promise<Headers>,
    private api: { handle(request: Request): Promise<Response> },
  ) {
    this.params = new URLSearchParams();
  }

  withParams(params: Record<string, unknown>): this {
    this.params = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    return this;
  }

  async get(url: string): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { headers });
    return this.api.handle(request);
  }

  async patch(url: string, body?: BodyInit): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { method: "PATCH", body, headers });
    return this.api.handle(request);
  }

  async post(url: string, body?: BodyInit): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { method: "POST", body, headers });
    return this.api.handle(request);
  }

  async delete(url: string): Promise<Response> {
    const reqUrl = new URL(url, "http://localhost");
    reqUrl.search = this.params.toString();
    const headers = await this.headers;
    const request = new Request(reqUrl, { method: "DELETE", headers });
    return this.api.handle(request);
  }
}

export function createTestClient(api: {
  handle(request: Request): Promise<Response>;
}) {
  function as(userId: number, headers?: HeadersInit) {
    const reqHeaders = new Headers(headers);
    const headersPromise = signAccess({ userId }).then((access) => {
      const accessCookie = new Bun.Cookie("access", access);
      reqHeaders.append("Cookie", accessCookie.toString());
      return reqHeaders;
    });
    return new TestClient(headersPromise, api);
  }

  return as;
}
