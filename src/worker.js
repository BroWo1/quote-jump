export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/bilibili/")) {
      const target =
        "https://api.bilibili.com" +
        url.pathname.replace("/api/bilibili", "") +
        url.search;
      const resp = await fetch(target, {
        headers: { Referer: "https://www.bilibili.com" },
      });
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
