# Legacy Barbershop — site de agendamento

Site público para clientes + painel do dono (`seusite.com/#admin`) com senha, bloqueio de dias/horários e e-mail automático a cada agendamento. Não precisa de `npm install`.

## Como colocar no ar (Render, Railway ou similar)
1. Suba esta pasta para um repositório no GitHub.
2. Crie um "Web Service" Node apontando para o repositório. Comando de início: `npm start`.
3. Crie uma conta em resend.com **com o e-mail belchiorfilippo@gmail.com** e gere uma API Key. (Sem domínio próprio, o Resend envia apenas para o e-mail da própria conta — que é o seu.)
4. Em "Environment variables" do serviço, configure:
   - `ADMIN_PASSWORD` — a senha do painel (obrigatória, escolha uma forte)
   - `RESEND_API_KEY` — a chave do passo 3
   - `OWNER_EMAIL` — opcional (padrão: belchiorfilippo@gmail.com)
   - `SHOP_TZ` — opcional (padrão: America/New_York)
   - `DATA_DIR` — pasta do disco persistente, ex.: `/data`
5. **Disco persistente:** adicione um disco/volume ao serviço e monte-o no caminho de `DATA_DIR`. Sem isso, os agendamentos podem ser apagados quando o serviço reinicia (os e-mails continuam sendo seu registro).
6. Abra `seusite.com/#admin` e entre com a senha.

Para rodar no computador: `ADMIN_PASSWORD=minhasenha node server.js` e abra http://localhost:3000
