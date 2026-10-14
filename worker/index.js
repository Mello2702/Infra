// Worker da Cloudflare: repassa todos os acessos (inclusive o WebSocket do
// Streamlit) para o container que roda o app Python.
import { Container, getContainer } from "@cloudflare/containers";

export class AppStreamlit extends Container {
  defaultPort = 8501;
  // Desliga o container após 30 min sem uso; o próximo acesso o religa.
  sleepAfter = "30m";
  // O app precisa sair para a internet para falar com o Supabase.
  enableInternet = true;

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    };
  }
}

export default {
  async fetch(request, env) {
    // Uma única instância: o Streamlit guarda as sessões dos usuários em memória.
    return getContainer(env.APP).fetch(request);
  },
};
