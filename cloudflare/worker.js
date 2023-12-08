export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/rest/v1/delivery')) {
      const client = url.searchParams.get('client') ?? env.CLIENT;
      url.hostname = `${client}.tt.omtrdc.net`;
    } else {
      url.hostname = env.HOST;
    }

    const newRequest = new Request(
      url.toString(),
      request,
    );

    return fetch(newRequest);
  },
};
