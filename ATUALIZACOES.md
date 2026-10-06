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

## Banco relacional e publicação

A partir da estrutura v2, o aplicativo usa tabelas relacionais PostgreSQL no schema **patrimonio**. A tabela antiga `public.lotea_state` é removida na primeira instalação desta estrutura. Não há importação do documento antigo: o responsável autorizou descartar os cadastros e vendas de teste. O administrador inicial é criado com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e, opcionalmente, `ADMIN_NAME` da Vercel.

Todas as gravações posteriores preservam os registros atuais e alteram somente as linhas envolvidas. Alterações de produto não recalculam comissões já registradas. Não há mais armazenamento local em JSON.

Validação: `npm test`, teste integrado PostgreSQL e `npm run build`. A Vercel recompila os fontes e inclui o arquivo de criação da estrutura.

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


## Encontrar os dados no Neon

Selecione o projeto, branch e database correspondentes à `DATABASE_URL` de Production na Vercel. No **Data Editor / Tables**, troque o schema para **patrimonio**.

| Tabela | Conteúdo |
|---|---|
| companies | Empresas e campos preparados para identidade visual |
| users | Uma linha por usuário; e-mail, nome, perfil e hash da senha |
| developers | Loteadoras |
| products / product_conditions / product_photos | Produtos, condições comerciais e imagens |
| lands / land_photos | Terrenos de terceiros e imagens |
| sales | Uma linha por venda, incluindo regras contratadas na ocasião |
| entry_installments | Uma linha por parcela da entrada |
| commission_installments | Uma linha por parcela de comissão |
| goals | Metas individuais padrão e coletivas por mês/ano |
| invitations / sessions / password_resets | Convites, sessões e links de recuperação |
| audit_events / land_history / sale_history / commission_history | Auditoria geral e históricos por registro |
| login_attempts / reset_requests / admin_recoveries | Controles de acesso e recuperações administrativas |
| schema_versions | Versão instalada da estrutura |

`password_hash` não é uma senha legível; não substitua por texto simples. Para alterações comuns de usuários, use o painel do aplicativo. O editor do Neon permite consultas e alterações diretas; as regras e chaves estrangeiras continuam sendo verificadas pelo PostgreSQL.

Os vínculos entre tabelas incluem `company_id`, impedindo relações entre empresas diferentes. A empresa atendida por cada instalação vem da variável de servidor `COMPANY_ID` (padrão `main`), nunca do navegador. `COMPANY_NAME` define o nome na criação inicial. A identidade visual pode ser editada pelo gestor na interface. Cadastro de empresas e roteamento por domínio ainda não estão incluídos.

A API usa transações, bloqueios por registro/recurso nas operações concorrentes e comparação de revisão nas atualizações. Não regrava um documento global. O painel ainda carrega uma visão completa da empresa; paginação e consultas específicas por tela podem ser adicionadas conforme o volume crescer.

## Desenvolvimento e testes

Use um PostgreSQL local separado, `LOCAL_DATABASE_URL` e as variáveis iniciais do administrador. Não use a conexão de produção nos testes. O teste integrado roda com `TEST_DATABASE_URL=... node --test server/postgres.test.mjs`, cria empresas isoladas de teste e verifica fluxos completos, valores monetários, relações, concorrência, recuperação e isolamento. Sem essa variável, apenas o teste integrado é pulado no `npm test`.

A estrutura é inicializada sob bloqueio transacional apenas na primeira conexão de cada processo; a versão no banco impede apagar dados novamente em redeploys. Uma falha de configuração ou criação reverte a transação. Não reverta para versões do aplicativo anteriores à estrutura v2: elas usam o armazenamento antigo.

## Meu perfil

Clique no seu nome na barra lateral ou em **Mais → seu nome** no celular. Cada pessoa pode alterar foto, nome, CPF, CRECI, e-mail e senha. CPF e CRECI são opcionais e só aparecem na resposta do próprio perfil, não na lista da equipe nem nos registros de auditoria. O CPF é armazenado sem pontuação e tem os dígitos verificadores validados. CRECI aceita número, categoria e UF em até 40 caracteres.

A foto aceita JPG, PNG ou WebP de até 10 MB na seleção, é recortada ao centro e reduzida a 320 × 320 pixels. O servidor limita o resultado a 200 mil caracteres. Ela pode ser removida pelo perfil.

Para mudar e-mail ou senha é obrigatório confirmar a senha atual. A senha nova tem de 12 a 128 caracteres. Essas alterações renovam a sessão deste navegador, encerram as outras sessões e invalidam os links de recuperação anteriores. Tentativas incorretas de confirmação são limitadas. CPF, foto e senhas não são gravados no texto de auditoria. A troca de e-mail não envia confirmação: o serviço de envio ainda é opcional; confira o endereço antes de salvar.

A estrutura v3 adiciona `cpf`, `creci` e `photo_data_url` à tabela `patrimonio.users`, preservando todos os usuários e demais dados existentes.


## White label: identidade visual

Em **Configurações → Identidade visual → Personalizar marca**, o gestor pode definir nome da empresa, logo e cores principal, de fundo e de destaque. A prévia permite conferir a combinação antes de salvar. Corretores não têm permissão para alterar a marca.

O upload aceita PNG, JPEG e WebP de até 10 MB; o navegador reduz a imagem para até 800 × 400, mantendo a proporção, e o servidor limita o resultado armazenado. SVG e endereços externos não são aceitos como logo.

A identidade é persistida na empresa e aplicada ao login, navegação, título e ícone da aba, gráficos e identificação das exportações. O assunto dos e-mails de recuperação usa o nome configurado; o remetente continua dependendo de `EMAIL_FROM`. Os dados existentes são preservados.

Esta etapa personaliza cada instalação, cuja empresa é selecionada no servidor por `COMPANY_ID`. Não inclui painel global de empresas, provisionamento automático, cobrança ou configuração de domínios próprios.
