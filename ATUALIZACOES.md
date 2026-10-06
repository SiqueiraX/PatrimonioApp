# Contas, leads e condições de venda

## Cadastro por convite

Em **Usuários → Convidar usuário**, o gestor informa o e-mail e o cargo. O sistema gera um link com validade de sete dias e uso único. O gestor copia e envia esse link à pessoa, que define nome e senha na tela de criação de conta. Não há envio automático de e-mail. Convites podem ser revogados; gerar outro para o mesmo e-mail invalida o anterior.

## Origem dos leads

Novas vendas exigem uma origem: Indicação, Marketplace, Disparo em massa, Tráfego pago, TikTok ou Base de contatos. É possível preencher a origem de uma venda antiga em seus detalhes, em **Atualizar contrato / pagamento**.

O dashboard mostra a quantidade de vendas por origem. O gráfico segue o período, produto e loteadora selecionados e permite escolher todas as vendas ou um corretor. Exclui canceladas e inclui vendas em andamento e concluídas, mesmo antes da assinatura. Dados antigos sem origem aparecem como **Não informada**. O servidor fornece apenas contagens agregadas da equipe, mantendo os detalhes das vendas restritos a seus responsáveis e gestores.

## Regras por produto

A loteadora mantém nome e contato. Percentual e dia de pagamento são definidos por bairro/produto. Cada produto possui uma ou mais condições aceitas:

| Exemplo | Entrada | Regra de comissão |
|---|---|---|
| Entrada parcelada usual | Com entrada em 6x | Acompanhar a entrada → 6x |
| Grupo Sinop | Qualquer condição aceita pelo bairro | Quantidade fixa: 1x, no mês seguinte, no dia do produto |
| Morada Brasil | Sem entrada | Quantidade fixa: 12x |
| Recanto dos Canários | Sem entrada | Quantidade fixa: 6x |

Configure as opções reais de cada empreendimento; não são criados ou modificados produtos existentes automaticamente. Duas condições não podem oferecer regras conflitantes para a mesma quantidade de parcelas da entrada. O percentual e o dia são comuns às condições de um mesmo produto.

Ao registrar a venda, o corretor escolhe apenas uma condição cadastrada. A regra é validada novamente no servidor e copiada para a venda. A comissão é sempre percentual do VGV, com centavos ajustados na última parcela e primeiro vencimento no mês seguinte à venda. As datas da entrada não deslocam as comissões.

Com entrada, o valor informado é o total da entrada. O sistema gera suas parcelas mensais a partir do primeiro vencimento. Cada parcela pode ser marcada como paga nos detalhes. Sem entrada, não existem parcelas de entrada nem alertas falsos de atraso. O financiamento restante do lote permanece fora deste controle.

## Compatibilidade e publicação

Vendas já existentes preservam suas regras, parcelas, recebimentos e histórico. Produtos antigos aparecem com uma condição compatível com sua regra anterior até que sejam editados. Não há limpeza, recálculo automático ou substituição de dados no Neon. O novo campo de convites é inicializado quando necessário no documento persistido; nenhuma variável de ambiente adicional é exigida.

Validação: `npm test` e `npm run build`. O deploy da Vercel usa os fontes e recompila o aplicativo.

## Metas de VGV

Em **Dashboard → Definir metas**, o gestor configura um valor individual padrão para todos os corretores e um valor coletivo independente. Configure cada mês e cada ano separadamente. O histórico de outros períodos é preservado. Novos corretores recebem a mesma meta integral, sem divisão ou proporcionalidade.

O andamento soma o VGV de contratos assinados, excluindo vendas canceladas, pela data da venda. Os quatro cartões mostram metas mensal e anual, individual e coletiva. O gestor pode selecionar o corretor; cada corretor acompanha seu próprio resultado e o total coletivo. O período das metas é independente dos filtros de produto e loteadora do dashboard.

## Identidade visual e navegação

A interface usa verde-petróleo #005b5b, fundo #f5f5f5 e destaques dourados #f4a90d. A origem dos leads é apresentada em gráfico de pizza. No celular, a navegação fica em um dock flutuante arredondado, com ações de gestão e saída em **Mais**.

## Recuperar o administrador pela Vercel

`ADMIN_EMAIL` e `ADMIN_PASSWORD` normalmente só são usadas para inicializar um banco vazio. Alterar ou remover essas variáveis não altera uma conta já persistida. `DATABASE_URL` continua obrigatório: nunca remova nem substitua o banco para recuperar a senha.

Para recuperar o administrador inicial sem perder dados:

1. Nas variáveis de **Production** da Vercel, defina `ADMIN_EMAIL` com seu e-mail e `ADMIN_PASSWORD` com uma nova senha de 12 a 128 caracteres.
2. Adicione `ADMIN_RECOVERY_ID` com um identificador novo, por exemplo `recuperacao-2026-10-06-1`.
3. Faça redeploy da versão mais recente e abra o site. A primeira requisição aplica a recuperação à conta inicial (`u1`, perfil Gestor), preservando sua identidade e cadastros. As sessões dessa conta e os bloqueios temporários de login são limpos.
4. Entre com os valores novos. Remova `ADMIN_RECOVERY_ID` e faça outro redeploy após confirmar o acesso.

Cada identificador só é usado uma vez, mesmo se permanecer configurado ou se um deploy antigo voltar a rodar. Uma recuperação posterior exige outro identificador. Não use esse mecanismo em bancos de demonstração. Não altera outras contas, vendas, produtos ou comissões. O evento é registrado na auditoria. Essas variáveis ficam exclusivamente no servidor; nunca use prefixo `VITE_` para senhas/chaves.

## Esqueci minha senha

A tela de login oferece recuperação por e-mail. Configure em **Production** na Vercel e faça redeploy:

- `RESEND_API_KEY`: chave de envio do Resend.
- `EMAIL_FROM`: remetente autorizado no Resend, como `Lotea <acesso@seu-dominio.com>`.
- `APP_URL`: URL pública oficial, como `https://patrimonio-app-self.vercel.app`.

O remetente/domínio deve ser verificado no Resend. Consulte https://resend.com/docs/api-reference/emails/send-email. Não há envio automático sem essa configuração; a interface informa a indisponibilidade. Erros de entrega são registrados no servidor como `password_reset_delivery_failed`, sem incluir endereços, chaves ou links.

Links têm 30 minutos de validade, tokens aleatórios de 256 bits armazenados como hash e uso único. O link não revela o e-mail e não é consumido ao abrir: apenas ao salvar a nova senha. Trocar a senha ou o e-mail também invalida links anteriores. Uma recuperação válida encerra as sessões da conta e libera o bloqueio do navegador. Pedidos não revelam se existe uma conta e são limitados por e-mail, IP e total por hora. O funcionamento completo do envio depende das credenciais e do remetente configurados pelo responsável.
