# Reservas de quadras — especificação das telas

Data: 2026-11-09 · Origem: proposta de telas aprovada para planejamento na conversa de 2026-11-09.

## Intenção

Levar ao frontend do Clube de Tênis os 12 itens de backlog de quadras, reservas, presença e fila de espera, com o mesmo visual e o mesmo cuidado da tela de login e da área logada: paleta da quadra, cards brancos, título pequeno em maiúsculas acima do título principal, alertas `.alert`/`.notice`, erros por campo, bolinha `rally` durante o carregamento e acessibilidade.

## Backlog coberto

| # | História | Tela |
|---|----------|------|
| US-A1 | Administrador cadastra quadras | Quadras |
| US-A2 | Administrador marca quadra em manutenção | Quadras (janela de manutenção) |
| US-J1 | Jogador vê a agenda e os horários livres | Agenda |
| US-J2 | Jogador reserva quadra livre | Agenda (painel de reserva) |
| US-J3 | Jogador vê reservas futuras e anteriores | Minhas reservas |
| US-J4 | Jogador cancela reserva | Minhas reservas / Detalhe |
| US-J5 | Jogador remarca reserva | Agenda em modo remarcar |
| US-S1 | Sistema impede duas reservas no mesmo horário | Agenda (tratamento do 409) |
| US-P1 | Participante confirma presença | Minhas reservas / Detalhe |
| US-O1 | Organizador vê quem confirmou | Detalhe da reserva |
| US-J6 | Jogador entra na fila de um horário ocupado | Agenda (painel de horário ocupado) |
| US-S2 | Sistema oferece a vaga liberada ao próximo da fila | Faixa "Vaga liberada" no Início e em Minhas reservas |

## Telas

1. **Quadras** (`#/quadras`, só administrador): cards com nome, piso, cobertura e status ("Disponível" ou "Em manutenção até …"). "Nova quadra" e "Editar" usam formulário no padrão do login. "Marcar manutenção" pede início, fim e motivo. Se houver reservas no período, mostra o aviso e pede confirmação antes de cancelá-las.
2. **Agenda** (`#/agenda`): faixa com os próximos 7 dias. Grade com horários nas linhas e quadras nas colunas, e quatro estados: livre, ocupado, sua reserva e manutenção, com legenda. Ao clicar em um horário livre, abre o painel de reserva com convite de jogadores. Ao clicar em um horário ocupado, abre o painel da fila. No celular, aparece uma quadra por vez, com abas.
3. **Minhas reservas** (`#/reservas`): abas Próximas, Anteriores e Fila de espera. Cards com data em destaque, quadra, horário e papel. O organizador vê a contagem de confirmados e os botões Remarcar e Cancelar. O convidado vê Confirmar presença e Não vou. A faixa amarela "Vaga liberada" aparece no topo com prazo, Aceitar e Recusar.
4. **Detalhe da reserva** (`#/reservas/{id}`): lista de participantes em Confirmados, Pendentes e Não vão, com as mesmas ações do card.
5. **Remarcar** (`#/agenda/remarcar/{id}`): a Agenda com uma faixa explicando o modo remarcar. A confirmação mostra **De → Para**.

## Decisões assumidas (confirmar com o time do backend)

- Horários fixos de 1 hora; a agenda exibe os horários que o backend devolve (o mock gera de 07:00 a 21:00).
- Reservas para hoje e os próximos 6 dias.
- Até 3 convidados por reserva. Os convidados são contas do clube, buscadas por nome.
- O organizador entra na lista de participantes, já com presença confirmada.
- Remarcar mantém os convidados e volta a presença deles para "pendente".
- A vaga liberada é oferecida ao primeiro da fila, que tem 30 minutos para aceitar. Se recusar ou o prazo passar, a vaga vai para o próximo.
- Manutenção sobre reservas existentes: o backend responde 409 e o administrador confirma o cancelamento delas.
- Horários exibidos no fuso do clube, `America/Sao_Paulo`.
- O backend ainda não tem esses endpoints. O contrato fica no plano e é implementado primeiro no mock.

## Fora do escopo

Notificações por e-mail ou push, pagamentos, regras de prioridade de sócio, cadastro de membros (já existe outra área) e calendário mensal.

## Segurança

O backend é a autoridade de permissões. O frontend esconde ações que não cabem ao usuário, mas trata 401, 403, 404 e 409 em toda chamada. Não usa HTML não escapado. Valida ids de rota antes de usá-los. Envia só os campos permitidos. Mostra o mínimo de dados de outros jogadores (só o nome). Mantém dependências de teste com versão exata e o lockfile no Git.
