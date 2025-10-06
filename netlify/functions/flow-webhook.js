const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

exports.handler = async (event) => {
  console.log('Webhook llamado');
  
  let token = null;
  if (event.httpMethod === 'POST' && event.body) {
    const body = querystring.parse(event.body);
    token = body.token;
  }
  
  if (!token) {
    return { statusCode: 200, body: 'OK' };
  }
  
  console.log('Token:', token);
  processPayment(token).catch(err => console.error('Error:', err));
  
  return { statusCode: 200, body: 'OK' };
};

async function processPayment(token) {
  try {
    const params = { apiKey: FLOW_API_KEY, token: token };
    const sortedKeys = Object.keys(params).sort();
    let signString = '';
    sortedKeys.forEach(key => { signString += key + params[key]; });
    
    const signature = crypto.createHmac('sha256', FLOW_SECRET).update(signString).digest('hex');
    params.s = signature;
    
    const postData = querystring.stringify(params);
    
    const flowData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'sandbox.flow.cl',
        path: '/api/payment/getStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        },
        rejectUnauthorized: false
      };
      
      console.log('Llamando Flow API...');
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('Flow respondió:', data);
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('JSON inválido: ' + data));
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('Error de conexión:', e.message);
        reject(e);
      });
      
      req.write(postData);
      req.end();
    });
    
    if (flowData.status === 2) {
      console.log('Pago aprobado');
      
      const appsParams = querystring.stringify({
        action: 'confirmarPagoFlowFromMake',
        token: token,
        flowOrder: flowData.flowOrder,
        commerceOrder: flowData.commerceOrder,
        amount: flowData.amount,
        status: flowData.status
      });
      
      await new Promise((resolve, reject) => {
        const req = https.request(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': appsParams.length
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve(data));
        });
        
        req.on('error', reject);
        req.write(appsParams);
        req.end();
      });
      
      console.log('Actualización completada');
    }
  } catch (error) {
    console.error('Error completo:', error.message);
  }
}