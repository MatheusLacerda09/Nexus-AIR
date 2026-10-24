# Diagrama de classes do domínio

Classes implementadas em `backend/models/` e seus relacionamentos, de acordo com a estrutura de dados do sistema (`backend/database/banco.sql` e `backend/database/migracao.py`).

![Diagrama de classes](diagrama-de-classes.png)

O código-fonte do diagrama (Mermaid) está em `diagrama-de-classes.mmd` e repetido no final deste arquivo.

## Classes

| Classe (Model) | Tabela | Papel no domínio |
|---|---|---|
| `EmpresaModel` | `empresa` | Empresa-cliente que assina o Nexus Air |
| `UsuarioModel` | `usuario` | Pessoa com acesso ao sistema (cargo, tipo de acesso, perfil) |
| `LocalTrabalhoModel` | `local_trabalho` | Empresa/local onde o usuário diz que trabalha |
| `AlertaModel` | `alerta` | Alerta de monitoramento (manual ou vindo do Zabbix) |
| `MaquinaVirtualModel` | `maquinas_virtuais` | Máquina virtual monitorada |
| `BancoModel` | `banco` | Banco de dados monitorado |

## Relacionamentos

| Relacionamento | Tipo | Multiplicidade | Base na estrutura de dados |
|---|---|---|---|
| `LocalTrabalhoModel` → `UsuarioModel` | **Agregação** | 0..1 para * | FK `usuario.local_trabalho_id` → `local_trabalho.id`, com `ON DELETE SET NULL`: o usuário continua existindo se o local for removido |
| `EmpresaModel` → `UsuarioModel` | Associação | 1 para * | `usuario.cliente` guarda o `empresa.nome` (sem FK declarada) |
| `EmpresaModel` → `AlertaModel` | Associação | 1 para * | `alerta.cliente` guarda o `empresa.nome` (sem FK declarada); toda consulta de alertas é filtrada por empresa |
| `AlertaModel` → `MaquinaVirtualModel` | Associação | * para 0..1 | FK `alerta.ip_maquina` → `maquinas_virtuais.ip` (a migração torna a coluna opcional, pois alertas do Zabbix podem não ter máquina cadastrada) |
| `AlertaModel` → `BancoModel` | Associação | * para 0..1 | FK `alerta.ip_banco` → `banco.ip` (opcional, pelo mesmo motivo) |

Dependências (linhas tracejadas): `EmpresaModel`, `UsuarioModel` e `LocalTrabalhoModel` usam seus repositórios para acessar o banco, e `UsuarioModel` usa `cargos.pode_gerenciar_usuarios` para calcular a permissão de gestão.

## Herança, composição e agregação

- **Herança:** não há. Nenhuma Model estende outra; todas são classes independentes.
- **Composição:** não há. Nenhuma Model tem existência dependente de outra (a exclusão de uma não apaga as demais).
- **Agregação:** uma, entre `LocalTrabalhoModel` (todo) e `UsuarioModel` (parte), explicada na tabela acima.

## Observações de coerência com o banco

- `AlertaModel` representa as colunas básicas de `alerta`. A tabela tem colunas adicionais criadas pela migração e tratadas pelo repositório (`cliente`, `severidade`, `descricao`, `recomendacao`, `criado_por`, `verificado`, `verificado_por`, `verificado_em`, `observacao_verificacao`, `zabbix_eventid`, `zabbix_estado`, `zabbix_host`, `zabbix_pendente`).
- `UsuarioModel` não expõe `foto_perfil` (o binário da foto); o acesso é feito por `buscar_foto` e `atualizar_foto`, e o atributo `foto_mime` indica o tipo.
- Tabelas sem Model dedicada, tratadas por services: `tarefa` e `alerta_tarefa` (chave `cliente`, também ligada à empresa pelo nome), além de `usuario_suporte`, `relatorio_alerta` e `relatorio` do `banco.sql`. Por isso não aparecem no diagrama.

## Código do diagrama (Mermaid)

```mermaid
classDiagram
    direction TB

    class EmpresaModel {
        <<Model>>
        +int id
        +str nome
        +str cnpjs
        +str endereco
        +str telefone
        +str email
        +str ceos
        +str setores
        +str departamentos
        +to_dict() dict
        +salvar() EmpresaModel
        +excluir() bool
        +buscar_por_id(empresa_id)$ EmpresaModel
        +buscar_por_cnpj(cnpj)$ EmpresaModel
        +buscar_por_email(email)$ EmpresaModel
        +listar_todos()$ list
        +listar_nomes()$ list
    }

    class UsuarioModel {
        <<Model>>
        +int id
        +str cliente
        +str nome
        +str senha
        +str email
        +str cargo
        +str departamento
        +str setor
        +str telefone
        +str cpf
        +date data_nascimento
        +str sexo
        +str tipo_acesso
        +str horario_trabalho
        +str curriculo
        +date data_ferias
        +int faltas
        +datetime criado_em
        +int local_trabalho_id
        +float volume_musica
        +str foto_mime
        +str idioma
        +to_dict() dict
        +definir_senha(senha_texto_puro)
        +verificar_senha(senha_texto_puro) bool
        +salvar() UsuarioModel
        +excluir() bool
        +buscar_por_id(usuario_id)$ UsuarioModel
        +buscar_por_email(email)$ UsuarioModel
        +buscar_por_cpf(cpf)$ UsuarioModel
        +listar_todos()$ list
        +listar_por_cliente(cliente)$ list
        +listar_nomes()$ list
        +buscar_foto(usuario_id)$
        +atualizar_foto(usuario_id, conteudo, mime)$
    }

    class LocalTrabalhoModel {
        <<Model>>
        +int id
        +str nome
        +str cnpj
        +to_dict() dict
        +buscar_por_id(local_trabalho_id)$ LocalTrabalhoModel
        +buscar_por_nome(nome)$ LocalTrabalhoModel
        +obter_ou_criar(nome, cnpj)$ LocalTrabalhoModel
        +listar_todos()$ list
    }

    class AlertaModel {
        <<Model>>
        +int id
        +str ip_maquina
        +str ip_banco
        +str tipo_alerta
        +str status_alerta
        +str contexto
        +datetime horario
        +str origem
        +to_dict() dict
    }

    class MaquinaVirtualModel {
        <<Model>>
        +int id
        +str hostname
        +str ip
        +str status_olvm
        +decimal consumo_cpu
        +decimal consumo_ram
        +str status_zabbix
        +to_dict() dict
    }

    class BancoModel {
        <<Model>>
        +int id
        +str ip
        +str status_zabbix
        +str status_olvm
        +str log_erro
        +decimal consumo_memoria
        +to_dict() dict
    }

    class EmpresaRepository {
        <<Repository>>
    }
    class UsuarioRepository {
        <<Repository>>
    }
    class LocalTrabalhoRepository {
        <<Repository>>
    }
    class cargos {
        <<módulo>>
        +pode_gerenciar_usuarios(cargo, tipo_acesso) bool
    }

    LocalTrabalhoModel "0..1" o-- "*" UsuarioModel : local_trabalho_id (FK)
    EmpresaModel "1" --> "*" UsuarioModel : cliente = nome
    EmpresaModel "1" --> "*" AlertaModel : cliente = nome
    MaquinaVirtualModel "0..1" <-- "*" AlertaModel : ip_maquina = ip (FK)
    BancoModel "0..1" <-- "*" AlertaModel : ip_banco = ip (FK)

    EmpresaModel ..> EmpresaRepository : usa
    UsuarioModel ..> UsuarioRepository : usa
    UsuarioModel ..> cargos : usa
    LocalTrabalhoModel ..> LocalTrabalhoRepository : usa
```
