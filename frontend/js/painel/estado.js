let tarefas = [
  { id: 'REL-00450', tarefa: 'Exportação API', origem: 'Oracle', tempo: '4:43/5:00', status: 'Em Execução' },
  { id: 'REL-00451', tarefa: 'Relatório', origem: 'Oracle', tempo: '4:43/5:00', status: 'Concluído' },
  { id: 'REL-00452', tarefa: 'Fechamento Mensal', origem: 'Oracle', tempo: '4:43/5:00', status: 'Concluído' },
  { id: 'REL-00453', tarefa: 'Exportação API', origem: 'Oracle', tempo: '4:43/5:00', status: 'Concluído' },
  { id: 'REL-00454', tarefa: 'Fechamento Mensal', origem: 'Oracle', tempo: '4:43/5:00', status: 'Concluído' },
  { id: 'REL-00455', tarefa: 'Relatório', origem: 'Oracle', tempo: '4:43/5:00', status: 'Concluído' }
];

let notificacoes = ['Falha de CPU em VM3 (09:12)', 'Relatório REL-00450 Falhou em VM2 (08:45)'];

const API_ALERTAS_URL = '/api/alertas/dashboard';

const timersAtivos = {};

let dominioEmpresaLogada = '';

let usuarioAtual = null;
