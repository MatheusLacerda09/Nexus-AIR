const express = require('express');
const path = require('path');
const sistemaController = require('./controllers/sistema_controller');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..')));

app.get('/api/sistema/status', sistemaController.status);

app.get('/', (req, res)=>{
  res.redirect('/frontend/html/index.html');
});

app.listen(PORTA, ()=>{
  console.log(`Nexus Air rodando em http://localhost:${PORTA}`);
});
