// Painel com o resumo do inventário e das visitas.
import { STATUS_EQUIPAMENTO } from "../constantes.js";
import { listarEquipamentos, listarVisitas } from "../dados.js";
import * as ui from "../ui.js";

const contar = (valores) => {
  const totais = new Map();
  for (const v of valores) totais.set(v, (totais.get(v) ?? 0) + 1);
  return [...totais].sort((a, b) => b[1] - a[1]);
};

function barras(itens) {
  const maximo = Math.max(...itens.map(([, total]) => total));
  return `<div class="barras">${itens
    .map(
      ([nome, total]) => `
      <div class="barra">
        <span class="barra__rotulo">${ui.esc(nome)}</span>
        <span class="barra__trilho"><span class="barra__valor" style="width:${((total / maximo) * 100).toFixed(1)}%"></span></span>
        <span class="barra__total">${total}</span>
      </div>`,
    )
    .join("")}</div>`;
}

const metrica = (rotulo, valor, destaque = false) =>
  `<div class="metrica${destaque ? " metrica--alerta" : ""}"><span>${ui.esc(rotulo)}</span><strong>${valor}</strong></div>`;

export async function render(el) {
  el.innerHTML = ui.cabecalho("Painel") + ui.CARREGANDO;
  let equipamentos, visitas;
  try {
    [equipamentos, visitas] = await Promise.all([listarEquipamentos(), listarVisitas()]);
  } catch (erro) {
    el.querySelector(".carregando").outerHTML = ui.erroHTML(erro.message);
    return;
  }

  const hoje = ui.hojeISO();
  const agendadas = visitas.filter((v) => v.status === "agendada");
  const atrasadas = agendadas.filter((v) => v.data_visita < hoje);
  const realizadasMes = visitas.filter((v) => v.status === "realizada" && v.data_visita.startsWith(hoje.slice(0, 7)));
  const proximas = [...agendadas].sort((a, b) => a.data_visita.localeCompare(b.data_visita)).slice(0, 10);
  const pendentes = visitas.filter((v) => v.status === "realizada" && v.pendencias).slice(0, 5);

  el.querySelector(".carregando").outerHTML = `
    <section class="metricas">
      ${metrica("Equipamentos", equipamentos.length)}
      ${metrica("Em manutenção", equipamentos.filter((e) => e.status === "manutencao").length)}
      ${metrica("Visitas agendadas", agendadas.length)}
      ${metrica("Visitas atrasadas", atrasadas.length, atrasadas.length > 0)}
      ${metrica("Realizadas no mês", realizadasMes.length)}
    </section>
    <div class="colunas">
      <section class="cartao">
        <h2>Equipamentos por unidade</h2>
        ${
          equipamentos.length
            ? barras(contar(equipamentos.map((e) => e.unidade ?? "Sem unidade"))) +
              `<p class="legenda">${contar(equipamentos.map((e) => e.status))
                .map(([s, total]) => `${ui.esc(STATUS_EQUIPAMENTO[s])}: ${total}`)
                .join(" · ")}</p>`
            : ui.vazio("Nenhum equipamento cadastrado ainda.")
        }
      </section>
      <section class="cartao">
        <h2>Próximas visitas</h2>
        <div data-proximas></div>
        ${
          pendentes.length
            ? `<h2>Pendências de visitas realizadas</h2><ul class="pendencias">${pendentes
                .map(
                  (v) =>
                    `<li><strong>${ui.esc(v.unidade)}</strong> (${ui.dataBR(v.data_visita)}): ${ui.esc(v.pendencias)}</li>`,
                )
                .join("")}</ul>`
            : ""
        }
      </section>
    </div>`;

  el.querySelector("[data-proximas]").replaceWith(
    proximas.length
      ? ui.tabela(
          [
            { campo: "data_visita", titulo: "Data", formato: ui.dataBR },
            { campo: "unidade", titulo: "Unidade" },
            { campo: "tipo", titulo: "Tipo" },
            { campo: "tecnico", titulo: "Técnico" },
            { campo: "data_visita", titulo: "Situação", formato: (d) => (d < hoje ? "Atrasada" : "No prazo") },
          ],
          proximas,
        )
      : Object.assign(document.createElement("p"), { className: "vazio", textContent: "Nenhuma visita agendada." }),
  );
}
