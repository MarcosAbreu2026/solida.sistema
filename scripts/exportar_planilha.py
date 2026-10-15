"""Exporta a planilha "SL_Pos Obra_Controle Integrado" para JSON (um arquivo por tabela).

Uso:  python scripts/exportar_planilha.py "dados/planilhas/SL_Pos Obra_Controle Integrado_R01.xlsx" dados/json

Lê os valores já calculados (data_only=True). Se a planilha foi editada no Excel e salva,
os valores calculados (ex.: situação da obra) vêm atualizados.
"""
import json, sys, datetime, pathlib
import openpyxl


def v(x):
    if isinstance(x, datetime.datetime):
        return x.date().isoformat()
    if isinstance(x, datetime.date):
        return x.isoformat()
    if isinstance(x, str):
        x = x.strip()
        return x or None
    return x


def tabela(ws, linha_cab, colunas, chave, ate=None):
    """colunas: {nome_campo: letra}. Para quando a coluna-chave estiver vazia em toda a linha."""
    out = []
    for r in range(linha_cab + 1, (ate or ws.max_row) + 1):
        reg = {k: v(ws[f"{c}{r}"].value) for k, c in colunas.items()}
        if reg.get(chave) in (None, ""):
            continue
        reg["_linha"] = r
        out.append(reg)
    return out


def main(xlsx, destino):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    dst = pathlib.Path(destino)
    dst.mkdir(parents=True, exist_ok=True)

    dados = {
        "obras": tabela(wb["Obras"], 4, dict(obra="A", cliente="B", endereco="C", tipo="D",
                                             situacao_calculada="E", responsavel="F"), "obra"),
        "servicos": tabela(wb["Serviços"], 4, dict(os="A", obra="B", situacao="C", data_inicio="D",
                                                   prazo="E", concluido_em="F", profissionais="G",
                                                   relato="H", obs="I", dias_atraso="J",
                                                   status_prazo="K"), "obra"),
        "equipe": tabela(wb["Equipe"], 4, dict(profissional="A", funcao="B", vinculo="C",
                                               valor_diaria="D", apelido_1="E", apelido_2="F",
                                               diarias_total="I", custo_total="J"), "profissional"),
        "financeiro": tabela(wb["Financeiro"], 4, dict(data="A", obra="B", tipo="C", descricao="D",
                                                       contraparte="E", valor="F", pago_recebido="G"),
                             "obra"),
    }
    # listas de apoio (colunas da aba Listas)
    ls = wb["Listas"]
    listas = {}
    for col in "ABCDEF":
        nome = ls[f"{col}4"].value
        if nome:
            listas[nome] = [ls[f"{col}{r}"].value for r in range(5, 25) if ls[f"{col}{r}"].value]
    dados["listas"] = listas

    # agenda: só células preenchidas -> {obra, data, texto}
    ag = wb["Agenda"]
    datas = {c.column: c.value for c in ag[4] if isinstance(c.value, (datetime.date, datetime.datetime))}
    agenda = []
    for r in range(5, ag.max_row + 1):
        obra = v(ag.cell(r, 1).value)
        if not obra:
            continue
        for col, d in datas.items():
            t = v(ag.cell(r, col).value)
            if t:
                agenda.append(dict(obra=obra, data=v(d), texto=t))
    dados["agenda"] = agenda

    for nome, conteudo in dados.items():
        (dst / f"{nome}.json").write_text(json.dumps(conteudo, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{nome}: {len(conteudo)} registros")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "dados/json")
