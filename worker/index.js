// Worker da Cloudflare: só entrega os arquivos estáticos da pasta web/.
// Toda a lógica roda no navegador, falando direto com o Supabase.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
