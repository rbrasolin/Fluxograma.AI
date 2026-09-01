/* =========================================================
   12-validacao.js  |  Gerador de Fluxograma
   Validação do fluxo e painel de validação
   (linhas 7811-7970 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
/* Considera o DESENHO (editor): existe uma conexão saindo de `idVisual`
   com o rótulo informado? Cobre setas para outra caixa e para terminais (Início/Fim).
   As chaves de rotulosConexoes usam o id visual da origem: "ORIGEM__DESTINO". */
function existeSaidaRotulada(idVisual, rotulo) {
  if (!idVisual) return false;
  const mapa = (typeof rotulosConexoes === "object" && rotulosConexoes) ? rotulosConexoes : {};
  const prefixo = idVisual + "__";
  const alvo = String(rotulo).trim().toLowerCase();
  return Object.keys(mapa).some(k =>
    k.indexOf(prefixo) === 0 && String(mapa[k]).trim().toLowerCase() === alvo
  );
}

function validarFluxo() {
  const erros = [];
  const avisos = [];
  const linhas = Array.isArray(fluxoData) ? fluxoData : [];

  // Linhas que viram etapas de verdade (mesma regra do obterEtapasDaTabela)
  const validas = linhas.filter(l => limpar(l.atividade || "") !== "");
  const uidsValidos = new Set(validas.map(l => l.uid));

  // Mapas uid <-> id visual (mesma ordem do export)
  const uidParaIdVisual = {};
  const idVisualParaUid = {};
  validas.forEach((l, i) => {
    const idv = gerarIdVisual(i);
    uidParaIdVisual[l.uid] = idv;
    idVisualParaUid[idv] = l.uid;
  });

  const nome = (uid) => {
    const l = linhas.find(x => x.uid === uid);
    const a = l ? limpar(l.atividade || "") : "";
    return a ? `"${a}"` : "(sem nome)";
  };

  // 1) Linha com dados mas sem atividade -> será ignorada
  linhas.forEach((l, i) => {
    const semAtividade = limpar(l.atividade || "") === "";
    const temAlgo = limpar(l.area || "") || limpar(l.tipo || "") ||
                    limpar(l.sistema || "") || limpar(l.tempo || "");
    if (semAtividade && temAlgo) {
      avisos.push(`Linha ${i + 1} tem dados preenchidos, mas está sem atividade — será ignorada no fluxo.`);
    }
  });

  const recebeEntrada = new Set();
  const temSaida = new Set();

  validas.forEach(l => {
    const saidas = [];
    if (l.proxSim) saidas.push(["Próxima", l.proxSim]);
    if (l.proxNao) saidas.push(["Não", l.proxNao]);
    (Array.isArray(l.extras) ? l.extras : []).forEach(ex => { if (ex) saidas.push(["Extra", ex]); });

    if (saidas.length) temSaida.add(l.uid);

    // 2) Referência quebrada: aponta p/ caixa que não existe (ou foi esvaziada)
    saidas.forEach(([rotulo, alvoUid]) => {
      if (!uidsValidos.has(alvoUid)) {
        erros.push(`A caixa ${nome(l.uid)} aponta (${rotulo}) para uma caixa que não existe mais.`);
      } else {
        recebeEntrada.add(alvoUid);
      }
    });

    // 3) Decisão: precisa do "Não" e o Sim/Não não podem ir para a mesma caixa
    if (ehDecisao(l)) {
      // "Não" pode estar definido de 3 formas:
      //  a) proxNao na tabela;
      //  b) alguma saída extra;
      //  c) no DESENHO (editor): uma conexão saindo da decisão rotulada "Não"
      //     — inclui seta para outra caixa e seta para o Fim/terminal.
      const idv = uidParaIdVisual[l.uid];
      const naoNoDesenho = existeSaidaRotulada(idv, "Não");
      const temNao = !!l.proxNao || (Array.isArray(l.extras) && l.extras.some(Boolean)) || naoNoDesenho;
      if (!temNao) {
        avisos.push(`A decisão ${nome(l.uid)} não tem o caminho de "Não" definido.`);
      }
      if (l.proxSim && l.proxNao && l.proxSim === l.proxNao) {
        avisos.push(`A decisão ${nome(l.uid)} tem "Sim" e "Não" apontando para a mesma caixa — a decisão não está ramificando.`);
      }
    }
  });

  // Início padrão entra na primeira caixa válida (salvo se redirecionado por inicioAlvo)
  if (validas.length && !(typeof inicioAlvo !== "undefined" && inicioAlvo)) {
    recebeEntrada.add(validas[0].uid);
  }

  // inicioAlvo / fimOrigem (id visual)
  if (typeof inicioAlvo !== "undefined" && inicioAlvo) {
    if (!idVisualParaUid[inicioAlvo]) {
      erros.push(`O "Início" foi direcionado para uma caixa que não existe (${inicioAlvo}).`);
    } else {
      recebeEntrada.add(idVisualParaUid[inicioAlvo]);
    }
  }
  if (typeof fimOrigem !== "undefined" && fimOrigem) {
    if (!idVisualParaUid[fimOrigem]) {
      erros.push(`O "Fim" foi ligado a uma origem que não existe (${fimOrigem}).`);
    } else {
      temSaida.add(idVisualParaUid[fimOrigem]);
    }
  }

  // Terminais extras (alvo = id visual)
  (Array.isArray(terminais) ? terminais : []).forEach(t => {
    if (!t || !t.alvo) return;
    const uid = idVisualParaUid[t.alvo];
    if (!uid) {
      erros.push(`Um terminal ${t.tipo === "inicio" ? "Início" : "Fim"} extra aponta para uma caixa que não existe (${t.alvo}).`);
      return;
    }
    if (t.tipo === "inicio") recebeEntrada.add(uid);
    else temSaida.add(uid);
  });

  // 4) Conexões faltando: sem entrada, sem saída, ou solta
  const lastUid = validas.length ? validas[validas.length - 1].uid : null;
  validas.forEach(l => {
    const temEnt = recebeEntrada.has(l.uid);
    // A última caixa vai ao "Fim" automaticamente; semSaida = saída removida de propósito.
    const temSai = temSaida.has(l.uid) || l.uid === lastUid || !!l.semSaida;
    if (!temEnt && !temSai) {
      avisos.push(`A caixa ${nome(l.uid)} está solta — sem entrada e sem saída.`);
    } else if (!temEnt) {
      avisos.push(`A caixa ${nome(l.uid)} não recebe nenhuma conexão de entrada.`);
    } else if (!temSai) {
      avisos.push(`A caixa ${nome(l.uid)} não tem conexão de saída — não segue para nenhuma próxima atividade.`);
    }
  });

  return { erros, avisos };
}

function renderPainelValidacao(resultado) {
  const painel = document.getElementById("painelValidacao");
  if (!painel) return;
  const r = resultado || { erros: [], avisos: [] };

  if (!r.erros.length && !r.avisos.length) {
    painel.className = "validacao-ok";
    painel.innerHTML = "&#10003; Nenhum problema encontrado no fluxo.";
    painel.style.display = "block";
    return;
  }

  let html = "";
  if (r.erros.length) {
    html += `<div class="val-grupo val-erros"><div class="val-titulo">&#9888; ${r.erros.length} ${r.erros.length === 1 ? "erro" : "erros"}</div><ul>`;
    r.erros.forEach(e => { html += `<li>${escaparHTML(e)}</li>`; });
    html += `</ul></div>`;
  }
  if (r.avisos.length) {
    html += `<div class="val-grupo val-avisos"><div class="val-titulo">${r.avisos.length} ${r.avisos.length === 1 ? "aviso" : "avisos"}</div><ul>`;
    r.avisos.forEach(a => { html += `<li>${escaparHTML(a)}</li>`; });
    html += `</ul></div>`;
  }
  painel.className = "";
  painel.innerHTML = html;
  painel.style.display = "block";
}

function validarFluxoManual() {
  if (!fluxoData || !fluxoData.length) {
    mostrarToast("Preencha a tabela antes de validar.", "alerta");
    return;
  }
  const r = validarFluxo();
  renderPainelValidacao(r);
  if (r.erros.length) {
    mostrarToast(`${r.erros.length} erro(s) encontrado(s) — veja o painel.`, "erro");
  } else if (r.avisos.length) {
    mostrarToast(`${r.avisos.length} aviso(s). O fluxo pode ser gerado.`, "alerta");
  } else {
    mostrarToast("Fluxo sem problemas.", "ok");
  }
}
