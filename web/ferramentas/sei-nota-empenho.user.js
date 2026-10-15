// ==UserScript==
// @name         SEI - Localizar Nota de Empenho
// @namespace    sei-nota-empenho
// @version      1.1
// @description  Pesquisa um processo no SEI-SP, mostra os números das "Nota de Empenho" em PDF da árvore e copia o resultado para o sistema nie.
// @match        https://sei.sp.gov.br/sei/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// Correções em relação à versão 1.0:
// - @match restrito ao SEI-SP (antes valia para qualquer site com "/sei/" no endereço);
// - a pesquisa usa requestSubmit(), que executa a rotina do próprio SEI ao enviar
//   o formulário (form.submit() a pulava);
// - não abre mais a pergunta sozinha após o login: só pelo botão "Consultar Empenho";
// - aceita números com 5 ou 6 dígitos após "NE" (SIAFI e SIAFEM);
// - depois de abrir as pastas da árvore, espera a árvore recarregar antes de ler;
// - número não encontrado não aparece mais com uma "fonte" que não foi a real;
// - botão "Copiar para o nie" leva o resultado para a página Processos do sistema.

(function () {
  'use strict';

  // Executa apenas na janela principal (não nos iframes da árvore/visualização)
  if (window.top !== window.self) return;

  const CHAVE_PROCESSO = 'seiEmpenho_processo';
  // Ex.: 2026NE000123 (SIAFI) ou 2026NE00123 (SIAFEM)
  const RE_EMPENHO = /\b(\d{4})\s*NE\s*(\d{5,6})\b/i;
  // Formato lido pelo botão "Colar do SEI" do sistema nie (web/js/paginas/processos.js).
  const FORMATO_NIE = 'nie-empenhos';
  const VERSAO_NIE = 1;

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const acao = new URL(location.href).searchParams.get('acao') || '';
  const pendente = sessionStorage.getItem(CHAVE_PROCESSO);

  criarBotao();

  if (pendente) {
    sessionStorage.removeItem(CHAVE_PROCESSO);
    if (acao === 'procedimento_trabalhar') {
      analisarProcesso(pendente);
    } else {
      mostrarPainel(
        `<b>Processo ${esc(pendente)}</b><br>A pesquisa não abriu um processo ` +
        `(não encontrado ou retornou várias ocorrências).`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 1) Solicitar o número e pesquisar
  // ---------------------------------------------------------------------------
  function solicitarProcesso() {
    const numero = (prompt('Informe o número do processo SEI:') || '').trim();
    if (!numero) return;

    const campo = document.getElementById('txtPesquisaRapida');
    const form = document.getElementById('frmProtocoloPesquisaRapida') || (campo && campo.form);
    if (!campo || !form) {
      alert('Campo "Pesquisar" não encontrado. Verifique se você está logado no SEI.');
      return;
    }
    campo.value = numero;
    sessionStorage.setItem(CHAVE_PROCESSO, numero);
    // requestSubmit() dispara o onsubmit do SEI; submit() não dispara.
    if (form.requestSubmit) form.requestSubmit();
    else form.submit();
  }

  // ---------------------------------------------------------------------------
  // 2) Ler a árvore do processo e localizar PDFs "Nota de Empenho"
  // ---------------------------------------------------------------------------
  async function analisarProcesso(processo) {
    const painel = mostrarPainel(`<b>Processo ${esc(processo)}</b><br>Analisando a árvore de documentos…`);

    let doc = await aguardarArvore();
    if (!doc) {
      painel.set(`<b>Processo ${esc(processo)}</b><br>Não foi possível ler a árvore de documentos.`);
      return;
    }

    // Processos grandes agrupam documentos em pastas fechadas: tenta abrir todas
    const abrirPastas = [...doc.querySelectorAll('a')]
      .find(a => /abrir todas as pastas/i.test(a.textContent + ' ' + (a.title || '')));
    if (abrirPastas) {
      abrirPastas.click();
      await esperar(1500);
      doc = (await aguardarArvore()) || doc;
    }

    const notas = encontrarNotasEmpenho(doc);
    if (!notas.length) {
      painel.set(`<b>Processo ${esc(processo)}</b><br>Nenhum documento PDF "Nota de Empenho" encontrado na árvore.`);
      return;
    }

    painel.set(`<b>Processo ${esc(processo)}</b><br>${notas.length} Nota(s) de Empenho encontrada(s). Lendo números…`);

    const resultados = [];
    for (const nota of notas) {
      let numero = extrairDoTexto(nota.texto);
      let origem = numero ? 'árvore' : null;
      if (!numero) {
        numero = await extrairDoPdf(nota.href).catch(() => null);
        if (numero) origem = 'conteúdo do PDF';
      }
      if (!numero) {
        numero = rotuloAposTipo(nota.texto);
        if (numero) origem = 'rótulo do documento';
      }
      resultados.push({ numero, origem, texto: nota.texto });
    }

    const linhas = resultados.map(r =>
      `<li><span style="font-size:15px;font-weight:bold">${esc(r.numero || 'não identificado')}</span>` +
      `<br><small>${esc(r.texto)}${r.origem ? ` — fonte: ${r.origem}` : ''}</small></li>`
    );
    const encontrados = resultados.map(r => r.numero).filter(Boolean);

    painel.set(
      `<b>Processo ${esc(processo)}</b><br>Nota(s) de Empenho:` +
      `<ul style="margin:6px 0 8px 18px;padding:0">${linhas.join('')}</ul>` +
      (encontrados.length
        ? '<button type="button" data-copiar-nie style="padding:6px 10px;background:#155bcb;color:#fff;' +
          'border:none;border-radius:5px;cursor:pointer">Copiar para o nie</button>' +
          ' <small data-copiado></small>'
        : '')
    );
    const botao = painel.elemento.querySelector('[data-copiar-nie]');
    if (botao) botao.addEventListener('click', () => copiarParaNie(processo, encontrados, painel.elemento));
  }

  function aguardarArvore(timeout = 20000) {
    return new Promise(resolve => {
      const inicio = Date.now();
      (function checar() {
        const ifr = document.getElementById('ifrArvore');
        let d = null;
        try { d = ifr && ifr.contentDocument; } catch (e) { /* ignora */ }
        if (d && d.readyState === 'complete' && d.querySelector('a[id^="anchor"]')) return resolve(d);
        if (Date.now() - inicio > timeout) return resolve(null);
        setTimeout(checar, 400);
      })();
    });
  }

  function encontrarNotasEmpenho(doc) {
    const resultado = [];
    doc.querySelectorAll('a[id^="anchor"]:not([id^="anchorImg"])').forEach(a => {
      const texto = a.textContent.replace(/\s+/g, ' ').trim();
      if (!/nota\s+de\s+empenho/i.test(texto)) return;

      // Verifica se o ícone do documento é de PDF
      const id = a.id.replace(/^anchor/, '');
      const icones = [
        doc.getElementById('icon' + id),
        ...doc.querySelectorAll('#anchorImg' + id + ' img'),
        ...(a.parentElement ? a.parentElement.querySelectorAll('img') : [])
      ].filter(Boolean);
      const ehPdf = icones.some(img => /pdf/i.test((img.src || '') + ' ' + (img.title || '') + ' ' + (img.alt || '')));
      if (!ehPdf) return;

      resultado.push({ texto, href: a.href });
    });
    return resultado;
  }

  // ---------------------------------------------------------------------------
  // 3) Extração do número do empenho
  // ---------------------------------------------------------------------------
  function extrairDoTexto(texto) {
    const m = (texto || '').match(RE_EMPENHO);
    return m ? `${m[1]}NE${m[2]}` : null;
  }

  // Ex.: "Nota de Empenho 123/2026 (45678901)" -> "123/2026"
  function rotuloAposTipo(texto) {
    const m = texto.match(/nota\s+de\s+empenho\s+(.+?)\s*(\(\d+\))?\s*$/i);
    return m && m[1] ? m[1].trim() : null;
  }

  async function extrairDoPdf(href) {
    if (!href || href.startsWith('javascript') || !window.pdfjsLib) return null;

    // Página de visualização do documento externo -> link de download do anexo
    const html = await (await fetch(href, { credentials: 'include' })).text();
    const d = new DOMParser().parseFromString(html, 'text/html');
    const el = d.querySelector(
      '[src*="documento_download_anexo"],[href*="documento_download_anexo"],[data*="documento_download_anexo"]'
    );
    const attr = el && (el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data'));
    const urlPdf = attr ? new URL(attr, href).href : href;

    const resp = await fetch(urlPdf, { credentials: 'include' });
    const buffer = await resp.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const paginas = Math.min(pdf.numPages, 2);
    for (let i = 1; i <= paginas; i++) {
      const pagina = await pdf.getPage(i);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items.map(it => it.str).join(' ');
      const numero = extrairDoTexto(texto);
      if (numero) return numero;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 4) Envio para o sistema nie (área de transferência)
  // ---------------------------------------------------------------------------
  async function copiarParaNie(processo, empenhos, painel) {
    const conteudo = JSON.stringify({ formato: FORMATO_NIE, versao: VERSAO_NIE, processo, empenhos });
    const aviso = painel.querySelector('[data-copiado]');
    try {
      await navigator.clipboard.writeText(conteudo);
      aviso.textContent = 'Copiado! No nie, use "Colar do SEI" na página Processos.';
    } catch (e) {
      // Sem permissão para a área de transferência: mostra o texto para copiar à mão.
      aviso.innerHTML = 'Copie o texto abaixo (Ctrl+C):<br>' +
        `<textarea readonly rows="3" style="width:100%">${esc(conteudo)}</textarea>`;
      aviso.querySelector('textarea').select();
    }
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------
  function criarBotao() {
    if (!document.getElementById('txtPesquisaRapida')) return;
    const b = document.createElement('button');
    b.textContent = 'Consultar Empenho';
    b.type = 'button';
    Object.assign(b.style, {
      position: 'fixed', bottom: '16px', left: '16px', zIndex: 99999,
      padding: '8px 12px', background: '#155bcb', color: '#fff',
      border: 'none', borderRadius: '6px', cursor: 'pointer', font: '13px sans-serif'
    });
    b.addEventListener('click', solicitarProcesso);
    document.body.appendChild(b);
  }

  function mostrarPainel(htmlInicial) {
    let p = document.getElementById('seiEmpenhoPainel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'seiEmpenhoPainel';
      Object.assign(p.style, {
        position: 'fixed', bottom: '16px', right: '16px', zIndex: 99999,
        maxWidth: '380px', padding: '12px 14px', background: '#fff', color: '#222',
        border: '1px solid #155bcb', borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,.2)', font: '13px/1.4 sans-serif'
      });
      document.body.appendChild(p);
    }
    const set = html => {
      p.innerHTML =
        '<span style="float:right;cursor:pointer;margin-left:8px" title="Fechar">✕</span>' + html;
      p.firstChild.onclick = () => p.remove();
    };
    set(htmlInicial);
    return { set, elemento: p };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }
})();
